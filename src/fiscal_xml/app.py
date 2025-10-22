# src/fiscal_xml/app.py

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import threading
import pandas as pd
import os
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
import json
import io
import zipfile
import glob

# --- Lógica de Negócios (Motor) ---

def get_base_path():
    """Retorna o diretório base (script ou .exe)."""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    else:
        # __file__ é src/fiscal_xml/app.py
        # A raiz do projeto é 3 níveis acima
        return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

CONFIG_FILE = os.path.join(get_base_path(), 'cnpjs_config.json')

def carregar_cnpjs():
    """Lê a lista de CNPJs do arquivo de configuração."""
    if not os.path.exists(CONFIG_FILE):
        return []
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, FileNotFoundError):
        return []

def salvar_cnpjs(lista_cnpjs):
    """Valida e salva a lista de CNPJs no arquivo de configuração."""
    cnpjs_limpos = []
    for cnpj in lista_cnpjs:
        cnpj_numeros = "".join(filter(str.isdigit, cnpj))
        if len(cnpj_numeros) == 14:
            cnpjs_limpos.append(cnpj_numeros)
    
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(cnpjs_limpos, f, indent=4)
        messagebox.showinfo("Sucesso", f"{len(cnpjs_limpos)} CNPJs válidos foram salvos!")
        return True
    except Exception as e:
        messagebox.showerror("Erro", f"Erro ao salvar o arquivo de configuração: {e}")
        return False

def processar_xml(file_path):
    """Processa um único arquivo XML NFe a partir do seu caminho."""
    nome_arquivo = os.path.basename(file_path)
    try:
        ns = {'nfe': 'http://www.portalfiscal.inf.br/nfe'}
        tree = ET.parse(file_path) 
        root = tree.getroot()
        infNFe = root.find('.//nfe:infNFe', ns)
        
        if infNFe is None:
            return [] # Ignora (pode ser cancelada ou outro tipo de XML)

        dados_capa = {'Arquivo': nome_arquivo}
        try:
            dados_capa['Numero NF'] = infNFe.findtext('.//nfe:ide/nfe:nNF', default='', namespaces=ns)
            data_emissao_str = infNFe.findtext('.//nfe:ide/nfe:dhEmi', namespaces=ns)
            if not data_emissao_str:
                data_emissao_str = infNFe.findtext('.//nfe:ide/nfe:dEmi', namespaces=ns)
            dados_capa['Data Emissao'] = data_emissao_str.split('T')[0] if data_emissao_str else ''
            
            dados_capa['CNPJ Emitente'] = infNFe.findtext('.//nfe:emit/nfe:CNPJ', default='', namespaces=ns)
            if not dados_capa['CNPJ Emitente']:
                dados_capa['CNPJ Emitente'] = infNFe.findtext('.//nfe:emit/nfe:CPF', default='Emitente sem CNPJ/CPF', namespaces=ns)
            
            dados_capa['Nome Emitente'] = infNFe.findtext('.//nfe:emit/nfe:xNome', default='', namespaces=ns)
            
            cnpj_dest = infNFe.findtext('.//nfe:dest/nfe:CNPJ', namespaces=ns)
            cpf_dest = infNFe.findtext('.//nfe:dest/nfe:CPF', namespaces=ns)
            dados_capa['CNPJ Destinatario'] = cnpj_dest or cpf_dest or "Destinatário sem CNPJ/CPF"
            
            dados_capa['Nome Destinatario'] = infNFe.findtext('.//nfe:dest/nfe:xNome', default='', namespaces=ns)
            dados_capa['Valor Total da Nota'] = float(infNFe.findtext('.//nfe:total/nfe:ICMSTot/nfe:vNF', default='0', namespaces=ns))
        
        except Exception as e:
            print(f"AVISO (Capa): {nome_arquivo}: {e}.")
            return []

        lista_de_itens = []
        for item in infNFe.findall('.//nfe:det', ns):
            try:
                def get_float(element, xpath, default='0'):
                    value = element.findtext(xpath, default=default, namespaces=ns)
                    try: return float(value)
                    except (ValueError, TypeError): return 0.0

                dados_item = {
                    'SKU': item.findtext('.//nfe:prod/nfe:cProd', default='', namespaces=ns),
                    'Produto': item.findtext('.//nfe:prod/nfe:xProd', default='', namespaces=ns),
                    'NCM': item.findtext('.//nfe:prod/nfe:NCM', default='', namespaces=ns),
                    'CFOP': item.findtext('.//nfe:prod/nfe:CFOP', default='', namespaces=ns),
                    'Quantidade': get_float(item, './/nfe:prod/nfe:qCom'),
                    'Valor Unitario': get_float(item, './/nfe:prod/nfe:vUnCom'),
                    'Valor Produto': get_float(item, './/nfe:prod/nfe:vProd'),
                    'Base ICMS': get_float(item, './/nfe:imposto/nfe:ICMS//nfe:vBC'),
                    'Aliq ICMS': get_float(item, './/nfe:imposto/nfe:ICMS//nfe:pICMS'),
                    'Valor ICMS Total': get_float(item, './/nfe:imposto/nfe:ICMS//nfe:vICMS'),
                    'Base IPI': get_float(item, './/nfe:imposto/nfe:IPI//nfe:vBC'),
                    'Aliq IPI': get_float(item, './/nfe:imposto/nfe:IPI//nfe:pIPI'),
                    'Valor IPI Total': get_float(item, './/nfe:imposto/nfe:IPI//nfe:vIPI'),
                    'Base PIS': get_float(item, './/nfe:imposto/nfe:PIS//nfe:vBC'),
                    'Aliq PIS': get_float(item, './/nfe:imposto/nfe:PIS//nfe:pPIS'),
                    'Valor PIS Total': get_float(item, './/nfe:imposto/nfe:PIS//nfe:vPIS'),
                    'Base COFINS': get_float(item, './/nfe:imposto/nfe:COFINS//nfe:vBC'),
                    'Aliq COFINS': get_float(item, './/nfe:imposto/nfe:COFINS//nfe:pCOFINS'),
                    'Valor COFINS Total': get_float(item, './/nfe:imposto/nfe:COFINS//nfe:vCOFINS'),
                }
                lista_de_itens.append({**dados_capa, **dados_item})
            except Exception as e_item:
                print(f"AVISO (Item): NF {dados_capa.get('Numero NF', 'N/A')}: {e_item}.")
                continue 
        return lista_de_itens
    
    except ET.ParseError as e_parse:
        print(f"AVISO (Parse): {nome_arquivo}: {e_parse}.")
        return []
    except Exception as e_geral:
        messagebox.showerror("Erro Crítico de XML", f"Erro inesperado ao processar {nome_arquivo}: {e_geral}")
        return []

def gerar_excel_para_cnpj(todos_os_itens, cnpj_empresa):
    """Gera um arquivo Excel (BytesIO) com 6 abas a partir de uma lista de itens."""
    output_excel = io.BytesIO()
    
    if not isinstance(todos_os_itens, list) or not all(isinstance(item, dict) for item in todos_os_itens):
         messagebox.showerror("Erro Interno", f"Dados inválidos para gerar Excel do CNPJ {cnpj_empresa}.")
         return None 
    
    df_geral_itens = pd.DataFrame(todos_os_itens)
    if df_geral_itens.empty:
         print(f"AVISO: Nenhum dado para gerar Excel para o CNPJ {cnpj_empresa}.")
         return None

    df_geral_itens['Data Emissao'] = pd.to_datetime(df_geral_itens['Data Emissao'], errors='coerce')
    df_geral_itens = df_geral_itens.dropna(subset=['Data Emissao'])
    df_geral_itens = df_geral_itens.sort_values(by=['Data Emissao', 'Numero NF'])
    
    colunas_itens_base = [
        'Arquivo', 'Numero NF', 'Data Emissao', 'CNPJ Emitente', 'Nome Emitente',
        'CNPJ Destinatario', 'Nome Destinatario', 'Valor Total da Nota', 'SKU',
        'Produto', 'NCM', 'CFOP', 'Quantidade', 'Valor Unitario', 'Valor Produto',
        'Base ICMS', 'Aliq ICMS', 'Valor ICMS Total', 'Base IPI', 'Aliq IPI',
        'Valor IPI Total', 'Base PIS', 'Aliq PIS', 'Valor PIS Total',
        'Base COFINS', 'Aliq COFINS', 'Valor COFINS Total'
    ]
    colunas_presentes_itens = [col for col in colunas_itens_base if col in df_geral_itens.columns]

    df_saidas_detalhe = df_geral_itens[df_geral_itens['Tipo'] == 'Saída (Venda)'][colunas_presentes_itens].copy()
    df_entradas_detalhe = df_geral_itens[df_geral_itens['Tipo'] == 'Entrada (Compra)'][colunas_presentes_itens].copy()

    if not df_saidas_detalhe.empty:
        df_resumo_clientes = df_saidas_detalhe.groupby('Nome Destinatario').agg(
            Qtd_Linhas_Itens=('Produto', 'count'),
            Valor_Total_Vendido=('Valor Produto', 'sum')
        ).sort_values(by='Valor_Total_Vendido', ascending=False).reset_index()
    else:
        df_resumo_clientes = pd.DataFrame(columns=['Nome Destinatario', 'Qtd_Linhas_Itens', 'Valor_Total_Vendido'])
    
    if not df_entradas_detalhe.empty:
        df_resumo_fornecedores = df_entradas_detalhe.groupby('Nome Emitente').agg(
            Qtd_Linhas_Itens=('Produto', 'count'),
            Valor_Total_Comprado=('Valor Produto', 'sum'),
        ).sort_values(by='Valor_Total_Comprado', ascending=False).reset_index()
    else:
        df_resumo_fornecedores = pd.DataFrame(columns=['Nome Emitente', 'Qtd_Linhas_Itens', 'Valor_Total_Comprado'])

    chave_nota = ['Numero NF', 'CNPJ Emitente', 'Data Emissao'] 
    colunas_id_nota = ['Numero NF', 'CNPJ Emitente', 'Data Emissao', 'Tipo',
                       'Nome Emitente', 'Nome Destinatario', 'CNPJ Destinatario',
                       'Valor Total da Nota']
    colunas_valores_nota = ['Valor Produto', 'Valor ICMS Total', 'Valor IPI Total',
                            'Valor PIS Total', 'Valor COFINS Total']
    
    agregacoes = {col: 'first' for col in colunas_id_nota if col not in chave_nota}
    agregacoes.update({col: 'sum' for col in colunas_valores_nota})
    
    colunas_necessarias_agg = chave_nota + list(agregacoes.keys())
    colunas_presentes_agg = [col for col in colunas_necessarias_agg if col in df_geral_itens.columns]
    
    if not colunas_presentes_agg or not any(col in colunas_valores_nota for col in colunas_presentes_agg):
         df_geral_notas = pd.DataFrame() 
    else:
        df_geral_notas = df_geral_itens[colunas_presentes_agg].groupby(chave_nota, as_index=False).agg(agregacoes)

    colunas_notas_ordenadas = [
        'Numero NF', 'CNPJ Emitente', 'Data Emissao', 'Tipo', 'Nome Emitente',
        'Nome Destinatario', 'CNPJ Destinatario', 'Valor Total da Nota',
        'Valor Produto', 'Valor ICMS Total', 'Valor IPI Total', 'Valor PIS Total', 'Valor COFINS Total'
    ]
    colunas_presentes_ordenadas = [col for col in colunas_notas_ordenadas if col in df_geral_notas.columns]
    
    if not df_geral_notas.empty:
        df_geral_notas = df_geral_notas[colunas_presentes_ordenadas].sort_values(by='Data Emissao')
        df_saidas_notas = df_geral_notas[df_geral_notas['Tipo'] == 'Saída (Venda)'].copy()
        df_entradas_notas = df_geral_notas[df_geral_notas['Tipo'] == 'Entrada (Compra)'].copy()
    else:
        df_saidas_notas = pd.DataFrame(columns=colunas_presentes_ordenadas)
        df_entradas_notas = pd.DataFrame(columns=colunas_presentes_ordenadas)

    try:
        with pd.ExcelWriter(output_excel, engine='openpyxl') as writer:
            df_resumo_clientes.to_excel(writer, sheet_name='1. Vendas por Cliente', index=False)
            df_resumo_fornecedores.to_excel(writer, sheet_name='2. Compras por Fornecedor', index=False)
            df_saidas_notas.to_excel(writer, sheet_name='3. Total Saídas (Notas)', index=False)
            df_entradas_notas.to_excel(writer, sheet_name='4. Total Entradas (Notas)', index=False)
            df_saidas_detalhe.to_excel(writer, sheet_name='5. Detalhe Saídas (Itens)', index=False)
            df_entradas_detalhe.to_excel(writer, sheet_name='6. Detalhe Entradas (Itens)', index=False)
        
        output_excel.seek(0)
        return output_excel
    except Exception as e_excel:
        messagebox.showerror(f"Erro ao Gerar Excel", f"Erro ao gerar o arquivo Excel para o CNPJ {cnpj_empresa}: {e_excel}")
        return None

def criar_zip_dos_relatorios(relatorios_excel):
    """Cria um arquivo ZIP em memória a partir de um dict de relatórios Excel."""
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for nome_arquivo, data_bytes in relatorios_excel.items():
            if data_bytes:
                zip_file.writestr(nome_arquivo, data_bytes.getvalue())
    zip_buffer.seek(0)
    return zip_buffer

# --- Interface Gráfica (Tkinter) ---

class App(tk.Tk):
    """Classe principal da Aplicação Desktop."""
    
    def __init__(self):
        super().__init__()
        
        self.title("🚀 Organizador Fiscal de XMLs")
        self.geometry("700x600") 
        self.minsize(650, 500)
        
        self.meus_cnpjs_lista = carregar_cnpjs()
        self.modo_importacao = tk.StringVar(value="unico")
        self.pasta_entrada_var = tk.StringVar()
        self.pasta_saida_var = tk.StringVar()
        self.pasta_unica_var = tk.StringVar()
        
        self.criar_widgets()
        self.atualizar_interface()
        self.verificar_cnpjs_iniciais()

    def criar_widgets(self):
        """Cria todos os componentes visuais da janela."""
        
        style = ttk.Style(self)
        style.configure('TButton', font=('Segoe UI', 10))
        style.configure('TRadiobutton', font=('Segoe UI', 10))
        style.configure('TLabel', font=('Segoe UI', 10))
        style.configure('TEntry', font=('Segoe UI', 10))

        main_frame = ttk.Frame(self, padding="10 10 10 20")
        main_frame.pack(fill="both", expand=True)
        
        frame_config = ttk.Frame(main_frame)
        frame_config.pack(fill="x", pady=(0, 10))
        
        btn_cnpj = ttk.Button(frame_config, text="⚙️ Gerir CNPJs da Empresa", command=self.abrir_janela_cnpjs)
        btn_cnpj.pack(anchor="w")

        self.cnpjs_label_var = tk.StringVar()
        self.atualizar_label_cnpjs()
        label_cnpjs = ttk.Label(frame_config, textvariable=self.cnpjs_label_var, foreground="gray")
        label_cnpjs.pack(anchor="w", pady=(5,0))

        ttk.Separator(main_frame, orient="horizontal").pack(fill="x", pady=10)

        frame_opcoes = ttk.Labelframe(main_frame, text="Modo de Importação", padding="10")
        frame_opcoes.pack(fill="x")
        
        rb_unico = ttk.Radiobutton(frame_opcoes, 
                                   text="Ambos (Entrada e Saída) na mesma pasta", 
                                   variable=self.modo_importacao, 
                                   value="unico", 
                                   command=self.atualizar_interface)
        rb_unico.pack(anchor="w")
        
        rb_separado = ttk.Radiobutton(frame_opcoes, 
                                      text="Pastas separadas para Entrada e Saída", 
                                      variable=self.modo_importacao, 
                                      value="separado", 
                                      command=self.atualizar_interface)
        rb_separado.pack(anchor="w")

        frame_pastas = ttk.Frame(main_frame, padding="0 10 0 0")
        frame_pastas.pack(fill="x", expand=True)
        frame_pastas.columnconfigure(1, weight=1)

        self.label_pasta_unica = ttk.Label(frame_pastas, text="Pasta (Ambos):")
        self.label_pasta_unica.grid(row=0, column=0, padx=(0, 5), pady=5, sticky="w")
        self.entry_pasta_unica = ttk.Entry(frame_pastas, textvariable=self.pasta_unica_var, state="disabled")
        self.entry_pasta_unica.grid(row=0, column=1, padx=5, pady=5, sticky="ew")
        self.btn_pasta_unica = ttk.Button(frame_pastas, text="Selecionar...", command=lambda: self.selecionar_pasta("unico"))
        self.btn_pasta_unica.grid(row=0, column=2, padx=5, pady=5)

        self.label_pasta_entrada = ttk.Label(frame_pastas, text="Pasta (Entrada):")
        self.label_pasta_entrada.grid(row=1, column=0, padx=(0, 5), pady=5, sticky="w")
        self.entry_pasta_entrada = ttk.Entry(frame_pastas, textvariable=self.pasta_entrada_var, state="disabled")
        self.entry_pasta_entrada.grid(row=1, column=1, padx=5, pady=5, sticky="ew")
        self.btn_pasta_entrada = ttk.Button(frame_pastas, text="Selecionar...", command=lambda: self.selecionar_pasta("entrada"))
        self.btn_pasta_entrada.grid(row=1, column=2, padx=5, pady=5)

        self.label_pasta_saida = ttk.Label(frame_pastas, text="Pasta (Saída):")
        self.label_pasta_saida.grid(row=2, column=0, padx=(0, 5), pady=5, sticky="w")
        self.entry_pasta_saida = ttk.Entry(frame_pastas, textvariable=self.pasta_saida_var, state="disabled")
        self.entry_pasta_saida.grid(row=2, column=1, padx=5, pady=5, sticky="ew")
        self.btn_pasta_saida = ttk.Button(frame_pastas, text="Selecionar...", command=lambda: self.selecionar_pasta("saida"))
        self.btn_pasta_saida.grid(row=2, column=2, padx=5, pady=5)

        ttk.Separator(main_frame, orient="horizontal").pack(fill="x", pady=10)

        self.btn_processar = ttk.Button(main_frame, text="🚀 Iniciar Processamento", command=self.iniciar_processamento_thread)
        self.btn_processar.pack(fill="x", ipady=10, pady=10)

        frame_log = ttk.Labelframe(main_frame, text="Log de Processamento", padding="10")
        frame_log.pack(fill="both", expand=True)
        
        self.log_text = scrolledtext.ScrolledText(frame_log, height=10, font=("Consolas", 9), wrap="word", state="disabled")
        self.log_text.pack(fill="both", expand=True)

    def log(self, mensagem):
        """Adiciona uma mensagem à caixa de log na interface."""
        self.log_text.config(state="normal")
        self.log_text.insert(tk.END, f"{datetime.now().strftime('%H:%M:%S')} - {mensagem}\n")
        self.log_text.see(tk.END)
        self.log_text.config(state="disabled")
        self.update_idletasks()

    def verificar_cnpjs_iniciais(self):
        """Verifica se há CNPJs ao iniciar e avisa o usuário."""
        if not self.meus_cnpjs_lista:
            self.log("AVISO: Nenhum CNPJ de empresa cadastrado.")
            messagebox.showwarning("Configuração Necessária", 
                                   "Nenhum CNPJ da sua empresa foi encontrado.\n\n"
                                   "Clique em '⚙️ Gerir CNPJs da Empresa' para cadastrá-los.")

    def atualizar_label_cnpjs(self):
        """Atualiza o texto que mostra os CNPJs carregados."""
        if self.meus_cnpjs_lista:
            self.cnpjs_label_var.set(f"CNPJs carregados: {', '.join(self.meus_cnpjs_lista)}")
        else:
            self.cnpjs_label_var.set("Nenhum CNPJ cadastrado.")

    def abrir_janela_cnpjs(self):
        """Abre uma janela Toplevel para gerir os CNPJs."""
        
        janela_cnpj = tk.Toplevel(self)
        janela_cnpj.title("Gerir CNPJs da Empresa")
        janela_cnpj.geometry("400x350")
        janela_cnpj.minsize(300, 300)
        janela_cnpj.transient(self)
        janela_cnpj.grab_set() 
        
        frame_janela = ttk.Frame(janela_cnpj, padding="15")
        frame_janela.pack(fill="both", expand=True)
        
        label_desc = ttk.Label(frame_janela, 
                               text="Cole os CNPJs da sua empresa (matriz e filiais), um por linha.", 
                               wraplength=370)
        label_desc.pack(pady=(0, 10))
        
        text_area = scrolledtext.ScrolledText(frame_janela, height=10, font=("Segoe UI", 10), wrap="word")
        text_area.pack(fill="both", expand=True, pady=5)
        
        text_area.insert(tk.END, "\n".join(carregar_cnpjs()))
        
        def ao_salvar():
            cnpjs_texto = text_area.get("1.0", tk.END)
            cnpjs_para_salvar = [cnpj.strip() for cnpj in cnpjs_texto.split('\n') if cnpj.strip()]
            
            if salvar_cnpjs(cnpjs_para_salvar):
                self.meus_cnpjs_lista = carregar_cnpjs()
                self.atualizar_label_cnpjs()
                janela_cnpj.destroy()

        btn_frame = ttk.Frame(frame_janela)
        btn_frame.pack(fill="x", pady=(10, 0))
        
        btn_salvar = ttk.Button(btn_frame, text="Salvar e Fechar", command=ao_salvar)
        btn_salvar.pack(side="right")
        
        btn_cancelar = ttk.Button(btn_frame, text="Cancelar", command=janela_cnpj.destroy)
        btn_cancelar.pack(side="right", padx=(0, 10))
        
        self.wait_window(janela_cnpj)

    def atualizar_interface(self):
        """Habilita/Desabilita os campos de pasta baseado no RadioButton."""
        modo = self.modo_importacao.get()
        
        if modo == "unico":
            self.label_pasta_unica.config(state="normal")
            self.entry_pasta_unica.config(state="normal")
            self.btn_pasta_unica.config(state="normal")
            
            self.label_pasta_entrada.config(state="disabled")
            self.entry_pasta_entrada.config(state="disabled")
            self.btn_pasta_entrada.config(state="disabled")
            self.label_pasta_saida.config(state="disabled")
            self.entry_pasta_saida.config(state="disabled")
            self.btn_pasta_saida.config(state="disabled")
        elif modo == "separado":
            self.label_pasta_unica.config(state="disabled")
            self.entry_pasta_unica.config(state="disabled")
            self.btn_pasta_unica.config(state="disabled")
            
            self.label_pasta_entrada.config(state="normal")
            self.entry_pasta_entrada.config(state="normal")
            self.btn_pasta_entrada.config(state="normal")
            self.label_pasta_saida.config(state="normal")
            self.entry_pasta_saida.config(state="normal")
            self.btn_pasta_saida.config(state="normal")

    def selecionar_pasta(self, tipo):
        """Abre o diálogo de seleção de pasta."""
        pasta_selecionada = filedialog.askdirectory(title=f"Selecione a Pasta de {tipo.capitalize()}")
        
        if not pasta_selecionada:
            return
            
        if tipo == "unico":
            self.pasta_unica_var.set(pasta_selecionada)
        elif tipo == "entrada":
            self.pasta_entrada_var.set(pasta_selecionada)
        elif tipo == "saida":
            self.pasta_saida_var.set(pasta_selecionada)
    
    def iniciar_processamento_thread(self):
        """Inicia o processamento pesado em uma thread separada."""
        self.btn_processar.config(state="disabled", text="Processando...")
        self.log("--- Início do Processamento ---")

        thread_processamento = threading.Thread(target=self.iniciar_processamento_real)
        thread_processamento.daemon = True
        thread_processamento.start()
        
        self.verificar_thread(thread_processamento)
        
    def verificar_thread(self, thread):
        """Verifica se a thread terminou e reativa a interface."""
        if thread.is_alive():
            self.after(100, lambda: self.verificar_thread(thread))
        else:
            self.log("--- Processamento Concluído ---")
            self.btn_processar.config(state="normal", text="🚀 Iniciar Processamento")
            
    def iniciar_processamento_real(self):
        """Lógica principal de processamento executada na thread."""
        
        if not self.meus_cnpjs_lista:
            self.log("ERRO: Nenhum CNPJ de empresa cadastrado.")
            messagebox.showerror("Erro", "Nenhum CNPJ da sua empresa está cadastrado.")
            return

        meus_cnpjs_set = set(self.meus_cnpjs_lista)
        modo = self.modo_importacao.get()
        lista_de_arquivos = []
        
        try:
            if modo == "unico":
                pasta_unica = self.pasta_unica_var.get()
                if not pasta_unica:
                    self.log("ERRO: Nenhuma pasta selecionada.")
                    messagebox.showerror("Erro", "Selecione a pasta que contém os XMLs.")
                    return
                caminho_busca = os.path.join(pasta_unica, "**", "*.xml")
                lista_de_arquivos = [(f, None) for f in glob.glob(caminho_busca, recursive=True)]
                
            elif modo == "separado":
                pasta_entrada = self.pasta_entrada_var.get()
                pasta_saida = self.pasta_saida_var.get()
                
                if not pasta_entrada or not pasta_saida:
                    self.log("ERRO: Pastas de Entrada e/ou Saída não selecionadas.")
                    messagebox.showerror("Erro", "Selecione as pastas de Entrada e Saída.")
                    return
                
                caminho_busca_ent = os.path.join(pasta_entrada, "**", "*.xml")
                lista_entrada = [(f, 'Entrada (Compra)') for f in glob.glob(caminho_busca_ent, recursive=True)]
                
                caminho_busca_sai = os.path.join(pasta_saida, "**", "*.xml")
                lista_saida = [(f, 'Saída (Venda)') for f in glob.glob(caminho_busca_sai, recursive=True)]
                lista_de_arquivos = lista_entrada + lista_saida

            if not lista_de_arquivos:
                self.log("AVISO: Nenhum arquivo .xml foi encontrado nas pastas selecionadas.")
                messagebox.showwarning("Aviso", "Nenhum arquivo .xml foi encontrado nas pastas selecionadas.")
                return
        
        except Exception as e_glob:
            self.log(f"ERRO ao buscar arquivos: {e_glob}")
            messagebox.showerror("Erro de Arquivo", f"Erro ao ler as pastas selecionadas: {e_glob}")
            return
            
        self.log(f"Encontrados {len(lista_de_arquivos)} arquivos XML. Iniciando leitura...")
        
        dados_por_cnpj_empresa = {}
        total_xmls_lidos = 0
        total_xmls_validos_processados = 0
        
        for file_path, tipo_forcado in lista_de_arquivos:
            total_xmls_lidos += 1
            if total_xmls_lidos % 50 == 0:
                self.log(f"Processando arquivo {total_xmls_lidos}/{len(lista_de_arquivos)}...")

            lista_de_itens_da_nota = processar_xml(file_path)
            
            if not lista_de_itens_da_nota:
                continue 
            
            total_xmls_validos_processados += 1
            item_exemplo = lista_de_itens_da_nota[0]
            
            tipo_operacao = None
            cnpj_proprietario = None
            
            if tipo_forcado:
                tipo_operacao = tipo_forcado
                if tipo_operacao == 'Entrada (Compra)':
                    cnpj_proprietario = "".join(filter(str.isdigit, item_exemplo.get('CNPJ Destinatario', '')))
                else:
                    cnpj_proprietario = "".join(filter(str.isdigit, item_exemplo.get('CNPJ Emitente', '')))
                
                if cnpj_proprietario not in meus_cnpjs_set:
                    self.log(f"AVISO: {os.path.basename(file_path)} na pasta '{tipo_forcado}' não pertence a um CNPJ cadastrado. Ignorando.")
                    continue
                    
            else:
                cnpj_emit_limpo = "".join(filter(str.isdigit, item_exemplo.get('CNPJ Emitente', '')))
                cnpj_dest_limpo = "".join(filter(str.isdigit, item_exemplo.get('CNPJ Destinatario', '')))
                
                if cnpj_emit_limpo in meus_cnpjs_set:
                    tipo_operacao = 'Saída (Venda)'
                    cnpj_proprietario = cnpj_emit_limpo
                elif cnpj_dest_limpo in meus_cnpjs_set:
                    tipo_operacao = 'Entrada (Compra)'
                    cnpj_proprietario = cnpj_dest_limpo
                else:
                    continue
            
            if cnpj_proprietario not in dados_por_cnpj_empresa:
                dados_por_cnpj_empresa[cnpj_proprietario] = []
            
            for item in lista_de_itens_da_nota:
                item['Tipo'] = tipo_operacao
                dados_por_cnpj_empresa[cnpj_proprietario].append(item)
        
        self.log(f"Leitura concluída. {total_xmls_validos_processados} notas válidas foram processadas.")
        
        if not dados_por_cnpj_empresa:
            self.log("Nenhuma nota fiscal correspondeu aos CNPJs cadastrados.")
            messagebox.showwarning("Sem Dados", "Nenhuma nota fiscal correspondeu aos CNPJs cadastrados.")
            return

        self.log(f"Gerando relatórios para {len(dados_por_cnpj_empresa)} CNPJ(s)...")
        
        relatorios_em_memoria = {}
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        erros_geracao_excel = 0
        
        for cnpj_empresa, lista_itens_cnpj in dados_por_cnpj_empresa.items():
            self.log(f"Gerando Excel para CNPJ ...{cnpj_empresa[-6:]}")
            bytes_excel = gerar_excel_para_cnpj(lista_itens_cnpj, cnpj_empresa)
            
            if bytes_excel:
                nome_arquivo_excel = f'Relatorio_Fiscal_CNPJ_{cnpj_empresa}_{timestamp}.xlsx'
                relatorios_em_memoria[nome_arquivo_excel] = bytes_excel
            else:
                erros_geracao_excel += 1
                self.log(f"ERRO ao gerar Excel para CNPJ {cnpj_empresa}.")

        if erros_geracao_excel > 0:
            messagebox.showerror("Erro", f"Ocorreram erros ao gerar {erros_geracao_excel} arquivo(s) Excel.")

        if not relatorios_em_memoria:
            self.log("Nenhum relatório Excel pôde ser gerado.")
            messagebox.showwarning("Aviso", "Nenhum relatório Excel pôde ser gerado.")
            return

        self.log("Pronto para salvar.")
        
        try:
            if len(relatorios_em_memoria) == 1:
                nome_arquivo = list(relatorios_em_memoria.keys())[0]
                dados_arquivo = list(relatorios_em_memoria.values())[0]
                
                caminho_salvar = filedialog.asksaveasfilename(
                    title="Salvar Relatório Excel Como...",
                    initialfile=nome_arquivo,
                    defaultextension=".xlsx",
                    filetypes=[("Arquivos Excel", "*.xlsx")]
                )
                
                if caminho_salvar:
                    with open(caminho_salvar, 'wb') as f:
                        f.write(dados_arquivo.getvalue())
                    self.log(f"Relatório salvo com sucesso em: {caminho_salvar}")
                    messagebox.showinfo("Sucesso", f"Relatório salvo com sucesso em:\n{caminho_salvar}")

            elif len(relatorios_em_memoria) > 1:
                self.log("Criando arquivo .zip com múltiplos relatórios...")
                zip_bytes = criar_zip_dos_relatorios(relatorios_em_memoria)
                nome_zip = f"Relatorios_Fiscais_{timestamp}.zip"
                
                caminho_salvar = filedialog.asksaveasfilename(
                    title="Salvar Relatórios (.zip) Como...",
                    initialfile=nome_zip,
                    defaultextension=".zip",
                    filetypes=[("Arquivos Zip", "*.zip")]
                )
                
                if caminho_salvar:
                    with open(caminho_salvar, 'wb') as f:
                        f.write(zip_bytes.getvalue())
                    self.log(f"Relatórios salvos com sucesso em: {caminho_salvar}")
                    messagebox.showinfo("Sucesso", f"{len(relatorios_em_memoria)} relatórios salvos com sucesso em:\n{caminho_salvar}")
        
        except Exception as e_salvar:
            self.log(f"ERRO CRÍTICO AO SALVAR: {e_salvar}")
            messagebox.showerror("Erro ao Salvar", f"Não foi possível salvar o arquivo.\nErro: {e_salvar}")
            

# --- Ponto de Entrada da Aplicação ---

def main():
    """Função principal para iniciar a aplicação."""
    app = App()
    app.mainloop()

if __name__ == "__main__":
    main()