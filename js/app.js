/**
 * ============================================
 * CAMADA 2: CONTROLADOR LÓGICO
 * ============================================
 * Orquestra a interface e os serviços
 * Gerencia o estado da aplicação
 */

class DailyPlannerApp {
    constructor() {
        // Serviços
        this.storage = window.storageService;
        this.ia = window.iaService;
        this.analytics = window.analyticsService;
        
        // Estado
        this.dataSelecionada = new Date();
        this.atividades = [];
        this.modoEdicao = false;
        this.atividadeEditando = null;
        
        // Inicializar
        this.init();
    }

    // ============ INICIALIZAÇÃO ============
    init() {
        console.log('🚀 Daily Planner Pro iniciado');
        
        this.atualizarDataDisplay();
        this.carregarAtividades();
        this.configurarEventos();
        this.configurarAtalhos();
        this.atualizarSidebar();
        
        // Atualizar sidebar a cada minuto
        setInterval(() => this.atualizarSidebar(), 60000);
    }

    configurarEventos() {
        // Enter no campo de atividade
        const inputNome = document.getElementById('nomeAtividade');
        if (inputNome) {
            inputNome.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.adicionarAtividade();
                }
            });
        }

        // Enter no prompt da IA
        const inputPrompt = document.getElementById('promptIA');
        if (inputPrompt) {
            inputPrompt.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.gerarRotinaIA();
                }
            });
        }

        // Fechar modais com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.fecharTodosModais();
            }
        });

        // Fechar modais clicando no overlay
        document.querySelectorAll('.overlay').forEach(overlay => {
            overlay.addEventListener('click', () => this.fecharTodosModais());
        });
    }

    configurarAtalhos() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+N: Nova atividade
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                document.getElementById('nomeAtividade')?.focus();
            }
            
            // Ctrl+T: Ir para hoje
            if (e.ctrlKey && e.key === 't') {
                e.preventDefault();
                this.irParaHoje();
            }
            
            // Setas: Navegar dias
            if (e.ctrlKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                this.mudarDia(-1);
            }
            
            if (e.ctrlKey && e.key === 'ArrowRight') {
                e.preventDefault();
                this.mudarDia(1);
            }
        });
    }

    // ============ NAVEGAÇÃO DE DATAS ============
    mudarDia(dias) {
        this.dataSelecionada.setDate(this.dataSelecionada.getDate() + dias);
        this.atualizarDataDisplay();
        this.carregarAtividades();
        this.atualizarSidebar();
    }

    irParaHoje() {
        this.dataSelecionada = new Date();
        this.atualizarDataDisplay();
        this.carregarAtividades();
        this.atualizarSidebar();
    }

    abrirCalendario() {
        document.getElementById('modalCalendario').classList.add('show');
        document.getElementById('overlayCalendario').classList.add('show');
        document.getElementById('inputDataCalendario').value = 
            this.storage.formatarData(this.dataSelecionada);
    }

    selecionarData() {
        const input = document.getElementById('inputDataCalendario');
        if (input && input.value) {
            this.dataSelecionada = new Date(input.value + 'T12:00:00');
            this.atualizarDataDisplay();
            this.carregarAtividades();
            this.atualizarSidebar();
        }
        this.fecharModal('modalCalendario');
    }

    fecharModal(modalId) {
        document.getElementById(modalId)?.classList.remove('show');
        // Fechar overlay correspondente
        const overlayId = modalId.replace('modal', 'overlay');
        document.getElementById(overlayId)?.classList.remove('show');
    }

    fecharTodosModais() {
        document.querySelectorAll('.modal.show').forEach(modal => {
            modal.classList.remove('show');
        });
        document.querySelectorAll('.overlay.show').forEach(overlay => {
            overlay.classList.remove('show');
        });
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

        const dataStr = this.storage.formatarData(this.dataSelecionada);
        const hojeStr = this.storage.formatarData(hoje);

        let prefixo = '';
        let classe = '';
        
        if (dataStr === hojeStr) {
            prefixo = '📍 HOJE';
            classe = 'badge-today';
        } else if (dataStr > hojeStr) {
            prefixo = '🔮 FUTURO';
            classe = 'badge-future';
        } else {
            prefixo = '📅 PASSADO';
            classe = 'badge-past';
        }

        display.textContent = `${prefixo} - ${dataFormatada}`;
        
        // Atualizar indicador
        const indicador = document.getElementById('indicadorDia');
        if (indicador) {
            indicador.textContent = prefixo;
            indicador.className = `badge ${classe}`;
        }
    }

    // ============ GERENCIAMENTO DE ATIVIDADES ============
    carregarAtividades() {
        this.atividades = this.storage.carregarDia(this.dataSelecionada);
        this.renderizarAtividades();
    }

    salvarAtividades() {
        this.storage.salvarDia(this.dataSelecionada, this.atividades);
        this.atualizarSidebar();
    }

    adicionarAtividade() {
        const nome = document.getElementById('nomeAtividade')?.value.trim();
        const hora = document.getElementById('horaAtividade')?.value;
        const duracao = parseInt(document.getElementById('duracaoAtividade')?.value || '30');
        const categoria = document.getElementById('categoriaAtividade')?.value || 'geral';

        // Validações
        if (!nome) {
            this.mostrarAlerta('erro', '⚠️ Digite o nome da atividade');
            document.getElementById('nomeAtividade')?.focus();
            return;
        }

        if (!hora) {
            this.mostrarAlerta('erro', '⚠️ Selecione um horário');
            return;
        }

        if (duracao < 1 || duracao > 480) {
            this.mostrarAlerta('erro', '⚠️ Duração deve ser entre 1 e 480 minutos');
            return;
        }

        // Verificar conflito de horário
        const conflito = this.atividades.find(a => a.hora === hora && !a.concluida);
        if (conflito) {
            const confirmar = confirm(
                `⚠️ Já existe "${conflito.nome}" neste horário.\n\nDeseja adicionar mesmo assim?`
            );
            if (!confirmar) return;
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
            concluidaEm: null,
            criadaPorIA: false
        };

        this.atividades.push(atividade);
        
        // Ordenar por horário
        this.atividades.sort((a, b) => {
            const [hA, mA] = a.hora.split(':').map(Number);
            const [hB, mB] = b.hora.split(':').map(Number);
            return (hA * 60 + mA) - (hB * 60 + mB);
        });

        this.salvarAtividades();
        this.renderizarAtividades();

        // Limpar campos
        const inputNome = document.getElementById('nomeAtividade');
        if (inputNome) {
            inputNome.value = '';
            inputNome.focus();
        }
        document.getElementById('duracaoAtividade').value = '30';

        this.mostrarAlerta('sucesso', `✅ "${nome}" adicionada com sucesso!`);
    }

    toggleConcluir(id) {
        const atividade = this.atividades.find(a => a.id === id);
        if (!atividade) return;

        atividade.concluida = !atividade.concluida;
        atividade.concluidaEm = atividade.concluida ? new Date().toISOString() : null;

        this.salvarAtividades();
        this.renderizarAtividades();

        const status = atividade.concluida ? 'concluída ✅' : 'reaberta 🔄';
        this.mostrarAlerta('sucesso', `Atividade ${status}`);
    }

    removerAtividade(id) {
        const atividade = this.atividades.find(a => a.id === id);
        if (!atividade) return;

        if (confirm(`🗑️ Remover "${atividade.nome}"?`)) {
            this.atividades = this.atividades.filter(a => a.id !== id);
            this.salvarAtividades();
            this.renderizarAtividades();
            this.mostrarAlerta('sucesso', '🗑️ Atividade removida');
        }
    }

    limparDia() {
        if (this.atividades.length === 0) {
            this.mostrarAlerta('erro', '📭 Nenhuma atividade para limpar');
            return;
        }

        const dataStr = this.storage.formatarData(this.dataSelecionada);
        const hojeStr = this.storage.formatarData(new Date());
        const mensagem = dataStr === hojeStr ? 
            '⚠️ Apagar TODAS as atividades de HOJE?' :
            `⚠️ Apagar TODAS as atividades de ${dataStr}?`;

        if (confirm(mensagem)) {
            this.atividades = [];
            this.salvarAtividades();
            this.renderizarAtividades();
            this.mostrarAlerta('sucesso', '🗑️ Dia limpo com sucesso!');
        }
    }

    duplicarDiaAnterior() {
        const ontem = new Date(this.dataSelecionada);
        ontem.setDate(ontem.getDate() - 1);
        
        const atividadesOntem = this.storage.carregarDia(ontem);
        
        if (atividadesOntem.length === 0) {
            this.mostrarAlerta('erro', '📭 Nenhuma atividade no dia anterior para duplicar');
            return;
        }

        if (confirm(`📋 Duplicar ${atividadesOntem.length} atividades do dia anterior?`)) {
            const novasAtividades = atividadesOntem.map(atv => ({
                ...atv,
                id: Date.now() + Math.floor(Math.random() * 1000),
                concluida: false,
                criadaEm: new Date().toISO
