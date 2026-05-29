/**
 * ============================================
 * CAMADA DE LÓGICA - Daily Planner
 * ============================================
 * Responsável por toda regra de negócio,
 * manipulação de dados e comunicação com APIs
 */

class DailyPlanner {
    constructor() {
        // Configuração
        this.API_KEY = localStorage.getItem('gemini_api_key') || '';
        this.dataSelecionada = new Date();
        this.atividades = [];
        
        // Inicializar
        this.init();
    }

    // ============ INICIALIZAÇÃO ============
    init() {
        console.log('🚀 Daily Planner iniciado');
        this.atualizarDataDisplay();
        this.carregarAtividades();
        this.configurarEventos();
        
        // Se tiver API key, mostrar no campo
        if (this.API_KEY) {
            const inputApi = document.getElementById('apiKeyInput');
            if (inputApi) inputApi.value = this.API_KEY;
        }
    }

    configurarEventos() {
        // Enter no formulário
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && 
                document.activeElement === document.getElementById('nomeAtividade')) {
                e.preventDefault();
                this.adicionarAtividade();
            }
        });
    }

    // ============ UTILITÁRIOS ============
    formatarData(data) {
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    }

    getStorageKey(data = null) {
        const d = data || this.dataSelecionada;
        return 'rotina_' + this.formatarData(d);
    }

    mostrarMensagem(tipo, texto, duracao = 3000) {
        const elementos = {
            erro: document.getElementById('msgErro'),
            sucesso: document.getElementById('msgSucesso'),
            loading: document.getElementById('msgLoading')
        };

        // Esconder todas
        Object.values(elementos).forEach(el => {
            if (el) el.classList.remove('show');
        });

        // Mostrar a correta
        const el = elementos[tipo];
        if (el) {
            el.textContent = texto;
            el.classList.add('show');
            
            if (duracao > 0) {
                setTimeout(() => {
                    el.classList.remove('show');
                }, duracao);
            }
        }
    }

    // ============ NAVEGAÇÃO DE DATAS ============
    mudarDia(dias) {
        this.dataSelecionada.setDate(this.dataSelecionada.getDate() + dias);
        this.atualizarDataDisplay();
        this.carregarAtividades();
    }

    irParaHoje() {
        this.dataSelecionada = new Date();
        this.atualizarDataDisplay();
        this.carregarAtividades();
    }

    abrirCalendario() {
        document.getElementById('popupCalendario').classList.add('show');
        document.getElementById('overlay').classList.add('show');
        document.getElementById('inputDataPopup').value = this.formatarData(this.dataSelecionada);
    }

    fecharPopup(id) {
        document.getElementById(id).classList.remove('show');
        document.getElementById('overlay').classList.remove('show');
    }

    selecionarData() {
        const input = document.getElementById('inputDataPopup');
        if (input && input.value) {
            this.dataSelecionada = new Date(input.value + 'T12:00:00');
            this.atualizarDataDisplay();
            this.carregarAtividades();
        }
        this.fecharPopup('popupCalendario');
    }

    atualizarDataDisplay() {
        const display = document.getElementById('dataDisplay');
        if (!display) return;

        const hoje = new Date();
        const dataFormatada = this.dataSelecionada.toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const dataStr = this.formatarData(this.dataSelecionada);
        const hojeStr = this.formatarData(hoje);

        if (dataStr === hojeStr) {
            display.textContent = '📍 HOJE - ' + dataFormatada;
        } else if (dataStr > hojeStr) {
            display.textContent = '🔮 ' + dataFormatada;
        } else {
            display.textContent = '📅 ' + dataFormatada;
        }
    }

    // ============ GERENCIAMENTO DE DADOS ============
    carregarAtividades() {
        const dados = localStorage.getItem(this.getStorageKey());
        this.atividades = dados ? JSON.parse(dados) : [];
        this.renderizarAtividades();
    }

    salvarAtividades() {
        localStorage.setItem(this.getStorageKey(), JSON.stringify(this.atividades));
    }

    // ============ OPERAÇÕES DE ATIVIDADE ============
    adicionarAtividade() {
        const nome = document.getElementById('nomeAtividade')?.value.trim();
        const hora = document.getElementById('horaAtividade')?.value;
        const duracao = parseInt(document.getElementById('duracaoAtividade')?.value || '30');
        const categoria = document.getElementById('categoriaAtividade')?.value || 'geral';

        // Validações
        if (!nome) {
            this.mostrarMensagem('erro', '⚠️ Digite o nome da atividade');
            return;
        }
        if (!hora) {
            this.mostrarMensagem('erro', '⚠️ Selecione um horário');
            return;
        }
        if (duracao < 1 || duracao > 480) {
            this.mostrarMensagem('erro', '⚠️ Duração deve ser entre 1 e 480 minutos');
            return;
        }

        // Criar atividade
        const atividade = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            nome: nome,
            hora: hora,
            duracao: duracao,
            categoria: categoria,
            concluida: false,
            criadaEm: new Date().toISOString(),
            concluidaEm: null
        };

        this.atividades.push(atividade);
        this.atividades.sort((a, b) => a.hora.localeCompare(b.hora));
        this.salvarAtividades();
        this.renderizarAtividades();

        // Limpar campos
        const inputNome = document.getElementById('nomeAtividade');
        if (inputNome) {
            inputNome.value = '';
            inputNome.focus();
        }

        this.mostrarMensagem('sucesso', '✅ Atividade adicionada!');
    }

    toggleConcluir(id) {
        const atividade = this.atividades.find(a => a.id === id);
        if (atividade) {
            atividade.concluida = !atividade.concluida;
            atividade.concluidaEm = atividade.concluida ? new Date().toISOString() : null;
            this.salvarAtividades();
            this.renderizarAtividades();
        }
    }

    removerAtividade(id) {
        if (confirm('🗑️ Remover esta atividade?')) {
            this.atividades = this.atividades.filter(a => a.id !== id);
            this.salvarAtividades();
            this.renderizarAtividades();
            this.mostrarMensagem('sucesso', '🗑️ Atividade removida');
        }
    }

    limparDia() {
        if (this.atividades.length === 0) {
            this.mostrarMensagem('erro', '📭 Nada para limpar');
            return;
        }

        if (confirm('⚠️ Apagar TODAS as atividades deste dia?')) {
            this.atividades = [];
            this.salvarAtividades();
            this.renderizarAtividades();
            this.mostrarMensagem('sucesso', '🗑️ Dia limpo!');
        }
    }

    // ============ RENDERIZAÇÃO ============
    renderizarAtividades() {
        const lista = document.getElementById('listaAtividades');
        if (!lista) return;

        if (this.atividades.length === 0) {
            const dataStr = this.formatarData(this.dataSelecionada);
            const hojeStr = this.formatarData(new Date());
            
            let mensagem = '✨ Nenhuma atividade para este dia';
            if (dataStr > hojeStr) {
                mensagem = '🔮 Planeje seu dia futuro! Adicione atividades';
            } else if (dataStr < hojeStr) {
                mensagem = '📭 Nenhuma atividade registrada neste dia';
            }

            lista.innerHTML = `
                <p class="vazio">
                    <span class="vazio-icon">📋</span>
                    ${mensagem}<br>
                    <small>Use o formulário acima ou peça ajuda da IA</small>
                </p>`;
            return;
        }

        const agora = new Date();
        const horaAtual = agora.getHours() * 60 + agora.getMinutes();
        const hojeStr = this.formatarData(agora);
        const dataStr = this.formatarData(this.dataSelecionada);

        const icones = {
            trabalho: '💼', estudo: '📚', saude: '💪',
            lazer: '🎮', casa: '🏠', geral: '📌'
        };

        lista.innerHTML = this.atividades.map(atv => {
            const [h, m] = atv.hora.split(':').map(Number);
            const minutosAtividade = h * 60 + m;
            
            let classe = '';
            let statusClass = '';
            let statusTexto = '';

            if (atv.concluida) {
                classe = 'concluida';
                statusClass = 'status-concluido';
                statusTexto = '✅ Concluída';
            } else if (dataStr === hojeStr && minutosAtividade < horaAtual) {
                classe = 'atrasada';
                statusClass = 'status-atrasado';
                statusTexto = '⚠️ Atrasada';
            } else if (dataStr > hojeStr) {
                classe = 'futura';
                statusClass = 'status-futuro';
                statusTexto = '📅 Programada';
            } else {
                statusClass = 'status-pendente';
                statusTexto = '⏳ Pendente';
            }

            const icon = icones[atv.categoria] || '📌';

            return `
                <div class="atividade-card ${classe}" data-id="${atv.id}">
                    <div class="atividade-info">
                        <div class="atividade-nome">${icon} ${atv.nome}</div>
                        <div class="atividade-detalhes">
                            <span>🕐 ${atv.hora}</span>
                            <span>⏱️ ${atv.duracao} min</span>
                            <span class="status-badge ${statusClass}">${statusTexto}</span>
                        </div>
                    </div>
                    <div class="atividade-acoes">
                        <button class="btn-acao btn-concluir" 
                                onclick="app.toggleConcluir(${atv.id})" 
                                title="${atv.concluida ? 'Reabrir' : 'Concluir'}">
                            ${atv.concluida ? '↩️' : '✅'}
                        </button>
                        <button class="btn-acao btn-remover" 
                                onclick="app.removerAtividade(${atv.id})" 
                                title="Remover">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ============ FUNÇÕES AUXILIARES ============
    copiarRotina() {
        if (this.atividades.length === 0) {
            this.m
