
// Configuração e Lógica do Supabase para FinanceApp Pro
const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado Global de Autenticação
let _currentUser = null;
let _isSyncing = false;

// Inicializar Autenticação
async function initAuth() {
    try {
        // Sempre verificar a sessão do Supabase primeiro
        const { data: { session }, error } = await _supabase.auth.getSession();
        
        if (session && session.user) {
            _currentUser = session.user;
            await loadUserData();
            showApp();
        } else {
            // Sem sessão - mostrar tela de login
            _currentUser = null;
            localStorage.clear();
            showAuth();
        }
    } catch (err) {
        console.error('Erro ao inicializar auth:', err);
        showAuth();
    }

    // Escutar mudanças na auth
    _supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            _currentUser = session.user;
            localStorage.clear();
            await loadUserData();
            showApp();
        } else if (event === 'SIGNED_OUT') {
            _currentUser = null;
            localStorage.clear();
            showAuth();
        }
    });
}

// Mostrar Telas
function showAuth() {
    document.getElementById('authScreen').classList.remove('hide');
}

function showApp() {
    document.getElementById('authScreen').classList.add('hide');
    CF.nome = _currentUser.user_metadata.nome || _currentUser.email;
    updUser();
    
    // Chamar checkAdmin com delay para garantir que tudo está carregado
    setTimeout(() => {
        console.log('Chamando checkAdmin - Email:', _currentUser?.email);
        checkAdmin();
    }, 100);
    
    initTrialTimer();
    go('dashboard');
    toast('Bem-vindo de volta! 👋');
    // Forçar re-render dos charts no mobile após tudo carregar
    setTimeout(() => {
        if (typeof rDash === 'function') rDash();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 300);
    // Re-render quando app volta ao foco (troca mobile/desktop)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && typeof rDash === 'function') {
            setTimeout(rDash, 100);
        }
    });
}

// Funções de Auth (Substituindo as originais)
async function authLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPass').value;

    if (!email || !password) {
        authShowErr('Preencha todos os campos.');
        return;
    }

    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) {
        authShowErr('Erro: ' + error.message);
    }
}

async function authCadastro() {
    const nome = document.getElementById('cadNome').value.trim();
    const email = document.getElementById('cadEmail').value.trim();
    const password = document.getElementById('cadPass').value;
    const pass2 = document.getElementById('cadPass2').value;

    if (!nome || !email || !password) {
        authShowErr('Preencha todos os campos.');
        return;
    }
    if (password !== pass2) {
        authShowErr('As senhas não coincidem.');
        return;
    }

    const { data, error } = await _supabase.auth.signUp({
        email,
        password,
        options: {
            data: { nome: nome }
        }
    });

    if (error) {
        authShowErr('Erro: ' + error.message);
    } else {
        toast('Cadastro realizado! Verifique seu e-mail ou faça login.');
        authToggle('login');
    }
}

async function authSair() {
    if (confirm('Deseja sair da sua conta?')) {
        // Limpar todos os dados locais
        localStorage.clear();
        sessionStorage.clear();
        
        // Resetar variáveis globais
        V = [];
        M = [];
        C = [];
        P = [];
        CF = {};
        _currentUser = null;
        
        // Fazer logout no Supabase
        await _supabase.auth.signOut();
        
        // Recarregar a página
        location.reload();
    }
}

// Sincronização de Dados
async function saveUserData() {
    if (!_currentUser || _isSyncing) return;
    _isSyncing = true;

    const payload = {
        user_id: _currentUser.id,
        vendas: V,
        movimentacoes: M,
        clientes: C,
        produtos: P,
        config: CF,
        updated_at: new Date().toISOString()
    };

    const { error } = await _supabase
        .from('user_data')
        .upsert(payload, { onConflict: 'user_id' });

    if (error) console.error('Erro ao salvar dados:', error);
    _isSyncing = false;
}

async function loadUserData() {
    if (!_currentUser) return;

    const { data, error } = await _supabase
        .from('user_data')
        .select('*')
        .eq('user_id', _currentUser.id)
        .single();

    if (data) {
        V = data.vendas || [];
        M = data.movimentacoes || [];
        C = data.clientes || [];
        P = data.produtos || [];
        Object.assign(CF, data.config || {});
        
        // Atualizar UI
        updUser();
        if (typeof rDash === 'function') setTimeout(rDash, 100);
        if (typeof lucide !== 'undefined') setTimeout(() => lucide.createIcons(), 150);
    } else {
        // Novo usuario - resetar tudo
        V = [];
        M = [];
        C = [];
        P = [];
        CF = {};
        
        // Novo usuário — limpar localStorage completamente
        localStorage.clear();
        // Criar registro inicial no Supabase
        await _supabase.from('user_data').insert({
            user_id: _currentUser.id,
            vendas: [],
            movimentacoes: [],
            clientes: [],
            produtos: [],
            config: {}
        });
    }
}

// Sobrescrever funções de salvamento local para usar Supabase
const originalSave = S.s;
S.s = function(key, val) {
    originalSave(key, val);
    // Mapear chaves locais para variáveis globais
    if (key === 'fa_v') V = val;
    if (key === 'fa_m') M = val;
    if (key === 'fa_c') C = val;
    if (key === 'fa_p') P = val;
    if (key === 'fa_cf') Object.assign(CF, val);
    
    saveUserData();
};

// Painel ADM (Apenas para o dono)
function checkAdmin() {
    const adminEmail = 'jardsonlucena97@gmail.com'; // Seu e-mail
    const adminBtn = document.getElementById('adminBtn');
    
    console.log('=== checkAdmin ===');
    console.log('_currentUser:', _currentUser);
    console.log('_currentUser.email:', _currentUser?.email);
    console.log('adminEmail:', adminEmail);
    console.log('adminBtn element:', adminBtn);
    console.log('Comparacao:', _currentUser?.email === adminEmail);
    
    if (_currentUser && _currentUser.email === adminEmail) {
        console.log('✓ ADMIN DETECTADO - Mostrando botao');
        if (adminBtn) {
            adminBtn.style.display = 'flex';
            adminBtn.style.visibility = 'visible';
            adminBtn.style.opacity = '1';
            adminBtn.style.pointerEvents = 'auto';
            console.log('✓ Botao ADM exibido');
        } else {
            console.log('✗ adminBtn nao encontrado no DOM');
        }
    } else {
        console.log('✗ Usuario nao eh admin');
        if (adminBtn) {
            adminBtn.style.display = 'none';
        }
    }
}

// Inicializar ao carregar
window.addEventListener('load', () => {
    initAuth();
});


// ═══ SISTEMA DE DEGUSTAÇÃO (30 MINUTOS) ═══
let _trialStartTime = null;
const TRIAL_DURATION_MS = 30 * 60 * 1000; // 30 minutos em milissegundos
const ADMIN_EMAIL = 'jardsonlucena97@gmail.com';

function initTrialTimer() {
    if (_currentUser && _currentUser.email === ADMIN_EMAIL) {
        // Admin tem acesso ilimitado
        return;
    }
    
    // Carregar tempo de início da sessão do localStorage
    const storageKey = `trial_start_${_currentUser.id}`;
    const savedStartTime = localStorage.getItem(storageKey);
    
    if (savedStartTime) {
        _trialStartTime = parseInt(savedStartTime);
    } else {
        _trialStartTime = Date.now();
        localStorage.setItem(storageKey, _trialStartTime.toString());
    }
    
    // Iniciar verificação a cada 5 segundos
    setInterval(checkTrialExpiration, 5000);
}

function checkTrialExpiration() {
    if (!_currentUser || _currentUser.email === ADMIN_EMAIL) return;
    
    const elapsedTime = Date.now() - _trialStartTime;
    const remainingTime = TRIAL_DURATION_MS - elapsedTime;
    
    if (remainingTime <= 0) {
        showPaymentScreen();
    }
}

function showPaymentScreen() {
    // Ocultar app principal
    document.querySelector('.main').style.display = 'none';
    
    // Criar tela de pagamento
    const paymentScreen = document.createElement('div');
    paymentScreen.id = 'paymentScreen';
    paymentScreen.style.cssText = `
        position: fixed;
        inset: 0;
        background: linear-gradient(135deg, rgba(59,130,246,.15), rgba(139,92,246,.1));
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 20px;
        font-family: 'Inter', sans-serif;
    `;
    
    paymentScreen.innerHTML = `
        <div style="
            background: #0D1526;
            border: 1px solid rgba(59,130,246,.3);
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
            box-shadow: 0 24px 80px rgba(0,0,0,.6);
        ">
            <div style="font-size: 48px; margin-bottom: 20px;">⏱️</div>
            <h2 style="
                font-family: 'Syne', sans-serif;
                font-size: 28px;
                font-weight: 800;
                color: #F1F5F9;
                margin-bottom: 12px;
            ">Período de Degustação Expirado</h2>
            <p style="
                color: #94A3B8;
                font-size: 14px;
                margin-bottom: 28px;
                line-height: 1.6;
            ">
                Você utilizou 30 minutos de acesso gratuito. Para continuar usando o FinanceApp Pro, escolha um plano de assinatura.
            </p>
            
            <div style="
                background: #111D35;
                border: 1px solid rgba(59,130,246,.2);
                border-radius: 14px;
                padding: 20px;
                margin-bottom: 24px;
                text-align: left;
            ">
                <div style="font-size: 12px; color: #64748B; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Dados para Pagamento</div>
                <div style="margin-bottom: 10px;">
                    <div style="font-size: 11px; color: #94A3B8; margin-bottom: 4px;">CNPJ</div>
                    <div style="font-size: 14px; color: #F1F5F9; font-weight: 600;">12.345.678/0001-90</div>
                </div>
                <div style="margin-bottom: 10px;">
                    <div style="font-size: 11px; color: #94A3B8; margin-bottom: 4px;">BANCO</div>
                    <div style="font-size: 14px; color: #F1F5F9; font-weight: 600;">Banco do Brasil</div>
                </div>
                <div>
                    <div style="font-size: 11px; color: #94A3B8; margin-bottom: 4px;">TITULAR</div>
                    <div style="font-size: 14px; color: #F1F5F9; font-weight: 600;">Jardson Lucena</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                <button onclick="window.location.href='https://wa.me/5585987654321'" style="
                    padding: 12px;
                    border-radius: 10px;
                    border: none;
                    background: rgba(37,211,102,.15);
                    color: #25D366;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all .2s;
                    font-size: 13px;
                ">💬 WhatsApp</button>
                <button onclick="window.location.href='mailto:jardsonlucena97@gmail.com'" style="
                    padding: 12px;
                    border-radius: 10px;
                    border: none;
                    background: rgba(59,130,246,.15);
                    color: #3B82F6;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all .2s;
                    font-size: 13px;
                ">📧 Email</button>
            </div>
            
            <button onclick="authSair()" style="
                width: 100%;
                padding: 12px;
                border-radius: 10px;
                border: 1px solid #EF4444;
                background: transparent;
                color: #EF4444;
                font-weight: 600;
                cursor: pointer;
                transition: all .2s;
                font-size: 13px;
            ">Sair</button>
        </div>
    `;
    
    document.body.appendChild(paymentScreen);
}
