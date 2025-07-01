// Adicione esta linha no TOPO ABSOLUTO do arquivo para ler o .env localmente (não afeta o Render)
require('dotenv').config();

// =================================================================
// 1. IMPORTAÇÃO DAS DEPENDÊNCIAS
// =================================================================
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

// =================================================================
// 2. CONFIGURAÇÕES INICIAIS
// =================================================================
const app = express();
const port = process.env.PORT || 3000;
const saltRounds = 10;

// =================================================================
// 3. MIDDLEWARES
// =================================================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// =================================================================
// 4. BANCO DE DADOS E SESSÃO (CONFIGURAÇÃO ROBUSTA PARA RENDER)
// =================================================================
// O 'Pool' se conecta usando a DATABASE_URL que o Render fornece automaticamente
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Essencial para a conexão com o banco de dados do Render
  }
});

const sessionStore = new pgSession({
    pool: db,
    tableName: 'session'
});

// AVISO IMPORTANTE PARA O EXPRESS: "Confie no proxy do Render"
// Isso garante que o cookie 'secure' funcione corretamente.
app.set('trust proxy', 1); 

app.use(session({
    store: sessionStore,
    // Esta variável PRECISA estar configurada no painel do Render
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false, // Alterado para false, é a melhor prática
    cookie: { 
        secure: true,
        httpOnly: true,
        sameSite: 'lax', // Configuração padrão e mais segura
        maxAge: 30 * 24 * 60 * 60 * 1000 // Duração de 30 dias
    }
}));

// =================================================================
// 5. MIDDLEWARES DE AUTENTICAÇÃO (COM LOGS DE DEPURAÇÃO)
// =================================================================
const isLoggedIn = (req, res, next) => {
    console.log(`[ISLOGGEDIN CHECK] Verificando acesso para a rota: ${req.originalUrl}`);
    console.log(`[ISLOGGEDIN CHECK] Sessão atual possui userId?:`, req.session.userId);

    if (req.session && req.session.userId) {
        console.log(`[ISLOGGEDIN CHECK] Acesso PERMITIDO para o usuário ID: ${req.session.userId}`);
        next();
    } else {
        console.log(`[ISLOGGEDIN CHECK] Acesso NEGADO. Redirecionando para /login.html`);
        res.redirect('/login.html');
    }
};

const isAdmin = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.status(403).json({ error: 'Acesso negado.' });
};

// =================================================================
// 6. ROTAS PÚBLICAS
// =================================================================
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.get('/login.html', (req, res) => { res.sendFile(path.join(__dirname, 'login.html')); });
app.get('/recrutamento.html', (req, res) => { res.sendFile(path.join(__dirname, 'recrutamento.html')); });
// Adicione outras rotas de páginas públicas se tiver

app.post('/recrutar', async (req, res) => {
    // ... (código da rota /recrutar, sem alterações)
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await db.query("SELECT id, nickname, password_hash FROM recrutas WHERE email = $1 AND status = 'aprovado'", [email]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            if (await bcrypt.compare(password, user.password_hash)) {
                const adminResult = await db.query("SELECT id FROM admins WHERE username = $1", [user.nickname]);
                
                req.session.userId = user.id;
                req.session.nickname = user.nickname;
                req.session.isAdmin = adminResult.rows.length > 0;
                
                return req.session.save(err => {
                    if (err) {
                        console.error("Erro ao salvar a sessão:", err);
                        return res.status(500).json({ success: false, message: 'Erro ao iniciar sessão.' });
                    }
                    console.log(`[LOGIN SUCCESS] Sessão para '${req.session.nickname}' salva! Redirecionando.`);
                    return res.json({ success: true, redirectUrl: '/dashboard.html' });
                });
            }
        }
        res.status(401).json({ success: false, message: 'Credenciais inválidas ou recrutamento não aprovado.' });
    } catch (error) {
        console.error("Erro CRÍTICO no /login:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) { console.error('Erro ao fazer logout:', err); }
        res.clearCookie('session_cookie_name'); // Use a chave do cookie aqui
        res.redirect('/');
    });
});

// =================================================================
// 7. ROTAS PROTEGIDAS E APIs DO DASHBOARD
// =================================================================
app.get('/dashboard.html', isLoggedIn, (req, res) => { res.sendFile(path.join(__dirname, 'dashboard.html')); });

app.get('/api/user/me', isLoggedIn, (req, res) => {
    res.json({
        nickname: req.session.nickname,
        isAdmin: req.session.isAdmin || false
    });
});

// ... (cole aqui TODAS as suas outras rotas de API, como /api/membros, /api/chat, e as rotas de admin)
// ...

// =================================================================
// 8. INICIAR O SERVIDOR
// =================================================================
app.listen(port, () => {
    console.log(`Servidor da Facção China rodando na porta ${port}`);
});
