
// Configuração e Lógica do Supabase para FinanceApp Pro
const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado Global de Autenticação
let _currentUser = null;
let _isSyncing = false;

// Inicializar Autenticação
async function initAuth() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        _currentUser = session.user;
        await loadUserData();
        showApp();
    } else {
        showAuth();
    }

    // Escutar mudanças na auth
    _supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN') {
            _currentUser = session.user;
            await loadUserData();
            showApp();
        } else if (event === 'SIGNED_OUT') {
            _currentUser = null;
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
    go('dashboard');
    toast('Bem-vindo de volta! 👋');
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
        await _supabase.auth.signOut();
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
        if (typeof renderAll === 'function') renderAll();
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
    if (_currentUser && _currentUser.email === adminEmail) {
        const sidebar = document.querySelector('.sb-nav');
        if (sidebar && !document.getElementById('adminBtn')) {
            const btn = document.createElement('div');
            btn.id = 'adminBtn';
            btn.className = 'sb-it';
            btn.innerHTML = `<span class="lci"><i data-lucide="shield-check"></i></span> Painel ADM`;
            btn.onclick = () => go('admin');
            sidebar.appendChild(btn);
            lucide.createIcons();
        }
    }
}

// Inicializar ao carregar
window.addEventListener('load', () => {
    initAuth().then(() => {
        checkAdmin();
    });
});
