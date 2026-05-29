/**
 * ============================================
 * CAMADA 3: SERVIÇOS E PERSISTÊNCIA
 * ============================================
 * Camada estratégica responsável por:
 * - Gerenciamento de Storage (LocalStorage)
 * - Comunicação com API Gemini
 * - Análise de dados e estatísticas
 * - Geração de relatórios
 * - Utilitários de data e formatação
 */

class StorageService {
    constructor() {
        this.prefix = 'daily_planner_';
        this.version = '2.0';
        this._initStorage();
    }

    _initStorage() {
        // Verificar versão e migrar dados se necessário
        const versao = localStorage.getItem(this.prefix + 'version');
        if (versao !== this.version) {
            console.log('🔄 Atualizando estrutura de dados...');
            localStorage.setItem(this.prefix + 'version', this.version);
        }
    }

    /**
     * Salva dados de um dia específico
     */
    salvarDia(data, atividades) {
        const key = this.prefix + 'dia_' + this.formatarData(data);
        localStorage.setItem(key, JSON.stringify({
            atividades: atividades,
            atualizadoEm: new Date().toISOString()
        }));
        this._atualizarIndice(data);
    }

    /**
     * Carrega dados de um dia específico
     */
    carregarDia(data) {
        const key = this.prefix + 'dia_' + this.formatarData(data);
        const dados = localStorage.getItem(key);
        if (dados) {
            const parsed = JSON.parse(dados);
            return parsed.atividades || [];
        }
        return [];
    }

    /**
     * Verifica se existe dados para uma data
     */
    diaExiste(data) {
        const key = this.prefix + 'dia_' + this.formatarData(data);
        return localStorage.getItem(key) !== null;
    }

    /**
     * Remove dados de um dia
     */
    removerDia(data) {
        const key = this.prefix + 'dia_' + this.formatarData(data);
        localStorage.removeItem(key);
        this._removerDoIndice(data);
    }

    /**
     * Lista todos os dias que têm dados
     */
    listarDiasComDados(limite = 30) {
        const indice = this._carregarIndice();
        return indice
            .sort((a, b) => b.localeCompare(a))
            .slice(0, limite);
    }

    /**
     * Busca dias em um intervalo
     */
    buscarDiasIntervalo(dataInicio, dataFim) {
        const dias = this.listarDiasComDados(365);
        const inicio = this.formatarData(dataInicio);
        const fim = this.formatarData(dataFim);
        
        return dias.filter(dia => dia >= inicio && dia <= fim);
    }

    /**
     * Salvar configuração
     */
    salvarConfig(chave, valor) {
        localStorage.setItem(this.prefix + 'config_' + chave, JSON.stringify(valor));
    }

    /**
     * Carregar configuração
     */
    carregarConfig(chave, valorPadrao = null) {
        const dados = localStorage.getItem(this.prefix + 'config_' + chave);
        return dados ? JSON.parse(dados) : valorPadrao;
    }

    /**
     * Exportar todos os dados
     */
    exportarTudo() {
        const todosDados = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.prefix)) {
                todosDados[key] = JSON.parse(localStorage.getItem(key));
            }
        }
        return {
            dados: todosDados,
            exportadoEm: new Date().toISOString(),
            versao: this.version
        };
    }

    /**
     * Limpar dados antigos (mais de 90 dias)
     */
    limparDadosAntigos() {
        const dias = this.listarDiasComDados(365);
        const limite = new Date();
        limite.setDate(limite.getDate() - 90);
        const limiteStr = this.formatarData(limite);
        
        let removidos = 0;
        dias.forEach(dia => {
            if (dia < limiteStr) {
                this.removerDia(new Date(dia + 'T00:00:00'));
                removidos++;
            }
        });
        
        return removidos;
    }

    /**
     * Obter estatísticas de armazenamento
     */
    getStorageInfo() {
        let usado = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key) && key.startsWith(this.prefix)) {
                usado += localStorage[key].length * 2; // UTF-16
            }
        }
        return {
            usadoKB: (usado / 1024).toFixed(2),
            usadoMB: (usado / (1024 * 1024)).toFixed(2),
            porcentagem: ((usado / 5242880) * 100).toFixed(1) // 5MB limite
        };
    }

    // ============ MÉTODOS PRIVADOS ============
    
    _atualizarIndice(data) {
        const indice = this._carregarIndice();
        const dataStr = this.formatarData(data);
        if (!indice.includes(dataStr)) {
            indice.push(dataStr);
            localStorage.setItem(this.prefix + 'indice', JSON.stringify(indice));
        }
    }

    _removerDoIndice(data) {
        const indice = this._carregarIndice();
        const dataStr = this.formatarData(data);
        const novoIndice = indice.filter(d => d !== dataStr);
        localStorage.setItem(this.prefix + 'indice', JSON.stringify(novoIndice));
    }

    _carregarIndice() {
        const dados = localStorage.getItem(this.prefix + 'indice');
        return dados ? JSON.parse(dados) : [];
    }

    formatarData(data) {
        const d = new Date(data);
        const ano = d.getFullYear();
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const dia = String(d.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    }
}

// ============================================
// SERVIÇO DE IA (GEMINI)
// ============================================

class IAService {
    constructor() {
        this.apiKey = localStorage.getItem('daily_planner_config_gemini_key') || '';
        this.modelo = 'gemini-2.0-flash';
        this.baseURL = 'https://generativelanguage.googleapis.com/v1beta/models';
    }

    /**
     * Configurar chave API
     */
    setApiKey(key) {
        this.apiKey = key;
        localStorage.setItem('daily_planner_config_gemini_key', key);
    }

    /**
     * Verificar se API está configurada
     */
    isConfigured() {
        return this.apiKey && this.apiKey.startsWith('AIza');
    }

    /**
     * Testar conexão com API
     */
    async testarConexao() {
        if (!this.isConfigured()) {
            throw new Error('API Key não configurada');
        }

        try {
            const response = await fetch(
                `${this.baseURL}/${this.modelo}:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: 'Responda apenas: OK' }]
                        }]
                    })
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Erro na conexão');
            }

            const data = await response.json();
            return data.candidates && data.candidates.length > 0;
        } catch (error) {
            console.error('Erro ao testar API:', error);
            throw error;
        }
    }

    /**
     * Gerar rotina com IA
     */
    async gerarRotina(prompt, dataContexto = null) {
        if (!this.isConfigured()) {
            throw new Error('Configure a API Key primeiro');
        }

        const contexto = dataContexto ? 
            `Considere que é ${dataContexto}. ` : '';

        const systemPrompt = `Você é um assistente especializado em organização de rotinas diárias.
${contexto}O usuário quer: "${prompt}"

Gere uma rotina com 5 a 8 atividades realistas e equilibradas.

REGRAS IMPORTANTES:
1. Retorne APENAS um array JSON válido
2. Cada atividade deve ter: nome, hora (HH:mm 24h), duracao (minutos), categoria
3. Categorias válidas: trabalho, estudo, saude, lazer, casa, geral
4. Distribua os horários ao longo do dia de forma lógica
5. Duração entre 15 e 180 minutos
6. Inclua pausas e refeições
7. Seja específico nos nomes das atividades

EXEMPLO DE FORMATO:
[
  {"nome": "Acordar e higiene matinal", "hora": "06:30", "duracao": 30, "categoria": "geral"},
  {"nome": "Café da manhã nutritivo", "hora": "07:00", "duracao": 30, "categoria": "saude"}
]`;

        try {
            const response = await fetch(
                `${this.baseURL}/${this.modelo}:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: systemPrompt }]
                        }],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 1000
                        }
                    })
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Erro ao gerar rotina');
            }

            const data = await response.json();
            const textoGerado = data.candidates[0].content.parts[0].text;
            
            // Extrair JSON da resposta
            const jsonMatch = textoGerado.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('Formato de resposta inválido');
            }

            const atividades = JSON.parse(jsonMatch[0]);
            
            // Validar e normalizar atividades
            return atividades.map(atv => ({
                nome: atv.nome,
                hora: atv.hora,
                duracao: Math.min(Math.max(parseInt(atv.duracao) || 30, 15), 180),
                categoria: ['trabalho', 'estudo', 'saude', 'lazer', 'casa', 'geral']
                    .includes(atv.categoria) ? atv.categoria : 'geral'
            }));

        } catch (error) {
            console.error('Erro ao gerar rotina:', error);
            throw error;
        }
    }

    /**
     * Sugerir melhorias na rotina existente
     */
    async sugerirMelhorias(atividadesExistentes) {
        if (!this.isConfigured()) {
            throw new Error('Configure a API Key primeiro');
        }

        const resumo = atividadesExistentes.map(a => 
            `${a.hora} - ${a.nome} (${a.duracao}min)`
        ).join('\n');

        const prompt = `Analise esta rotina e sugira 3 melhorias práticas:
${resumo}

Responda com um array JSON de sugestões:
[{"tipo": "ajuste"|"adicao"|"alerta", "descricao": "..."}]`;

        try {
            const response = await fetch(
                `${this.baseURL}/${this.modelo}:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: prompt }]
                        }]
                    })
                }
            );

            const data = await response.json();
            const texto = data.candidates[0].content.parts[0].text;
            const jsonMatch = texto.match(/\[[\s\S]*\]/);
            
            return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        } catch (error) {
            console.error('Erro ao sugerir melhorias:', error);
            return [];
        }
    }
}

// ============================================
// SERVIÇO DE ANÁLISE E RELATÓRIOS
// ============================================

class AnalyticsService {
    constructor(storageService) {
        this.storage = storageService;
    }

    /**
     * Análise dos últimos N dias
     */
    analisarPeriodo(dias = 7) {
        const hoje = new Date();
        const dadosPeriodo = [];
        
        for (let i = dias - 1; i >= 0; i--) {
            const data = new Date(hoje);
            data.setDate(data.getDate() - i);
            const atividades = this.storage.carregarDia(data);
            
            dadosPeriodo.push({
                data: this.storage.formatarData(data),
                dataObj: new Date(data),
                diaSemana: data.toLocaleDateString('pt-BR', { weekday: 'short' }),
                atividades: atividades,
                total: atividades.length,
                concluidas: atividades.filter(a => a.concluida).length,
                pendentes: atividades.filter(a => !a.concluida).length,
                tempoTotal: atividades.reduce((s, a) => s + a.duracao, 0),
                taxaConclusao: atividades.length > 0 ? 
                    Math.round((atividades.filter(a => a.concluida).length / atividades.length) * 100) : 0
            });
        }

        return {
            periodo: dadosPeriodo,
            resumo: this._gerarResumo(dadosPeriodo),
            tendencias: this._analisarTendencias(dadosPeriodo),
            categorias: this._analisarCategorias(dadosPeriodo),
            periodos: this._analisarPeriodos(dadosPeriodo)
        };
    }

    /**
     * Gerar resumo do período
     */
    _gerarResumo(dados) {
        const diasComDados = dados.filter(d => d.total > 0);
        
        return {
            diasAtivos: diasComDados.length,
            totalAtividades: diasComDados.reduce((s, d) => s + d.total, 0),
            totalConcluidas: diasComDados.reduce((s, d) => s + d.concluidas, 0),
            mediaConclusao: diasComDados.length > 0 ?
                Math.round(diasComDados.reduce((s, d) => s + d.taxaConclusao, 0) / diasComDados.length) : 0,
            tempoTotalMinutos: diasComDados.reduce((s, d) => s + d.tempoTotal, 0),
            melhorDia: this._encontrarMelhorDia(diasComDados),
            piorDia: this._encontrarPiorDia(diasComDados),
            sequenciaAtual: this._calcularSequencia(dados)
        };
    }

    /**
     * Análise de tendências
     */
    _analisarTendencias(dados) {
        const diasComDados = dados.filter(d => d.total > 0);
        if (diasComDados.length < 2) return { tipo: 'insuficiente', descricao: 'Dados insuficientes' };

        const primeira = diasComDados[0].taxaConclusao;
        const ultima = diasComDados[diasComDados.length - 1].taxaConclusao;
        const diferenca = ultima - primeira;

        return {
            tipo: diferenca > 5 ? 'melhorando' : diferenca < -5 ? 'piorando' : 'estavel',
            variacao: diferenca,
            descricao: diferenca > 5 ? '📈 Em evolução' : 
                      diferenca < -5 ? '📉 Precisa de atenção' : '📊 Estável'
        };
    }

    /**
     * Análise por categorias
     */
    _analisarCategorias(dados) {
        const categorias = {};
        
        dados.forEach(dia => {
            dia.atividades.forEach(atv => {
                const cat = atv.categoria || 'geral';
                if (!categorias[cat]) {
                    categorias[cat] = {
                        nome: cat,
                        total: 0,
                        concluidas: 0,
                        tempoTotal: 0
                    };
                }
                categorias[cat].total++;
                if (atv.concluida) categorias[cat].concluidas++;
                categorias[cat].tempoTotal += atv.duracao;
            });
        });

        return Object.values(categorias)
            .map(cat => ({
                ...cat,
                taxaConclusao: cat.total > 0 ? 
                    Math.round((cat.concluidas / cat.total) * 100) : 0
            }))
            .sort((a, b) => b.total - a.total);
    }

    /**
     * Análise por período do dia
     */
    _analisarPeriodos(dados) {
        const periodos = {
            manha: { nome: 'Manhã (6-12h)', total: 0, concluidas: 0 },
            tarde: { nome: 'Tarde (12-18h)', total: 0, concluidas: 0 },
            noite: { nome: 'Noite (18-24h)', total: 0, concluidas: 0 },
            madrugada: { nome: 'Madrugada (0-6h)', total: 0, concluidas: 0 }
        };

        dados.forEach(dia => {
            dia.atividades.forEach(atv => {
                const hora = parseInt(atv.hora.split(':')[0]);
                let periodo;
                if (hora >= 6 && hora < 12) periodo = 'manha';
                else if (hora >= 12 && hora < 18) periodo = 'tarde';
                else if (hora >= 18 && hora < 24) periodo = 'noite';
                else periodo = 'madrugada';
                
                periodos[periodo].total++;
                if (atv.concluida) periodos[periodo].concluidas++;
            });
        });

        return Object.values(periodos);
    }

    /**
     * Encontrar melhor dia
     */
    _encontrarMelhorDia(dados) {
        if (dados.length === 0) return null;
        return dados.reduce((melhor, atual) => 
            atual.taxaConclusao > melhor.taxaConclusao ? atual : melhor
        );
    }

    /**
     * Encontrar pior dia
     */
    _encontrarPiorDia(dados) {
        const diasComAtividades = dados.filter(d => d.total > 0);
        if (diasComAtividades.length === 0) return null;
        return diasComAtividades.reduce((pior, atual) => 
            atual.taxaConclusao < pior.taxaConclusao ? atual : pior
        );
    }

    /**
     * Calcular sequência de dias consecutivos
     */
    _calcularSequencia(dados) {
        let sequencia = 0;
        for (let i = dados.length - 1; i >= 0; i--) {
            if (dados[i].total > 0) sequencia++;
            else break;
        }
        return sequencia;
    }

    /**
     * Histórico detalhado
     */
    getHistoricoDetalhado(dias = 30) {
        const hoje = new Date();
        const historico = [];
        
        for (let i = 0; i < dias; i++) {
            const data = new Date(hoje);
            data.setDate(data.getDate() - i);
            const atividades = this.storage.carregarDia(data);
            
            if (atividades.length > 0) {
                historico.push({
                    data: this.storage.formatarData(data),
                    dataFormatada: data.toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    }),
                    diaSemana: data.toLocaleDateString('pt-BR', { weekday: 'short' }),
                    totalAtividades: atividades.length,
                    concluidas: atividades.filter(a => a.concluida).length,
                    taxaConclusao: Math.round((atividades.filter(a => a.concluida).length / atividades.length) * 100),
                    primeiraAtividade: atividades[0]?.nome || '-',
                    ultimaAtividade: atividades[atividades.length - 1]?.nome || '-'
                });
            }
        }
        
        return historico;
    }
}

// ============================================
// SERVIÇO DE EXPORTAÇÃO
// ============================================

class ExportService {
    /**
     * Exportar dados de um dia como JSON
     */
    static exportarDiaJSON(data, atividades) {
        const exportData = {
            data: data,
            exportadoEm: new Date().toISOString(),
            totalAtividades: atividades.length,
            concluidas: atividades.filter(a => a.concluida).length,
            atividades: atividades
        };
        
        return {
            dados: JSON.stringify(exportData, null, 2),
            nomeArquivo: `rotina_${data}.json`,
            tipo: 'application/json'
        };
    }

    /**
     * Exportar relatório completo
     */
    static exportarRelatorioCompleto(analise) {
        const relatorio = {
            titulo: 'Relatório Daily Planner Pro',
            geradoEm: new Date().toISOString(),
            periodo: `${analise.periodo[0]?.data} a ${analise.periodo[analise.periodo.length - 1]?.data}`,
            resumo: analise.resumo,
            tendencias: analise.tendencias,
            categorias: analise.categorias,
            periodos: analise.periodos
        };
        
        return {
            dados: JSON.stringify(relatorio, null, 2),
            nomeArquivo: `relatorio_${new Date().toISOString().split('T')[0]}.json`,
            tipo: 'application/json'
        };
    }

    /**
     * Exportar como CSV
     */
    static exportarCSV(historico) {
        let csv = 'Data,Dia,Total,Concluídas,Taxa Conclusão\n';
        
        historico.forEach(h => {
            csv += `${h.data},${h.diaSemana},${h.totalAtividades},${h.concluidas},${h.taxaConclusao}%\n`;
        });
        
        return {
            dados: csv,
            nomeArquivo: `historico_${new Date().toISOString().split('T')[0]}.csv`,
            tipo: 'text/csv'
        };
    }

    /**
     * Fazer download de arquivo
     */
    static download(dados, nomeArquivo, tipo) {
        const blob = new Blob([dados], { type: tipo });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nomeArquivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// ============================================
// INSTÂNCIA GLOBAL DOS SERVIÇOS
// ============================================

// Criar instâncias globais
window.storageService = new StorageService();
window.iaService = new IAService();
window.analyticsService = new AnalyticsService(window.storageService);

console.log('✅ Camada 3 (Serviços) inicializada com sucesso');
