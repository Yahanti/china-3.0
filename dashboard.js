document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA DE NAVEGAÇÃO DAS ABAS ---
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            if (!targetId) return;
            document.querySelectorAll('.nav-link').forEach(navLink => navLink.classList.remove('active'));
            document.querySelectorAll('.content-panel').forEach(panel => panel.classList.remove('active'));
            link.classList.add('active');
            document.getElementById(targetId + '-section')?.classList.add('active');
        });
    });

    // --- FUNÇÕES DE ADMIN ---
    async function handleAdminAction(id, action) {
        if (!confirm(`Tem certeza que deseja ${action} este recruta?`)) return;
        try {
            const response = await fetch(`/api/admin/${action}/${id}`, { method: 'POST' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Falha na operação.');
            showNotification(result.message, 'success');
            await carregarRecrutasPendentes();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }

    async function carregarRecrutasPendentes() {
        const container = document.getElementById('pending-recruits-container');
        if (!container) return;
        container.innerHTML = '<p>Carregando...</p>';
        try {
            const response = await fetch('/api/admin/recrutas-pendentes'); // <-- Chamada correta
            if (!response.ok) throw new Error('Falha ao buscar recrutas.');
            const recruits = await response.json();
            if (recruits.length === 0) {
                container.innerHTML = '<p>Nenhum recrutamento pendente.</p>';
                return;
            }
            container.innerHTML = ''; 
            recruits.forEach(recruta => {
                const card = document.createElement('div');
                card.className = 'aviso-card';
                card.innerHTML = `<h4>${recruta.nickname}</h4><p><strong>Email:</strong> ${recruta.email}</p><p><strong>ID:</strong> ${recruta.game_id}</p><div style="margin-top:15px;"><button class="btn-aprovar">Aprovar</button><button class="btn-rejeitar">Rejeitar</button></div>`;
                card.querySelector('.btn-aprovar').addEventListener('click', () => handleAdminAction(recruta.id, 'aprovar'));
                card.querySelector('.btn-rejeitar').addEventListener('click', () => handleAdminAction(recruta.id, 'rejeitar'));
                container.appendChild(card);
            });
        } catch (error) { container.innerHTML = `<p style="color:red;">${error.message}</p>`; }
    }
    
    // --- FUNÇÃO PRINCIPAL PARA CARREGAR TUDO ---
    async function carregarDadosIniciais() {
        try {
            const [userRes, avisosRes, membrosRes] = await Promise.all([
                fetch('/api/user/me'),
                fetch('/api/avisos'),
                fetch('/api/membros') // <-- Chamada correta
            ]);

            if (!userRes.ok) throw new Error('Sessão inválida.');

            const userData = await userRes.json();
            document.getElementById('member-name').textContent = userData.nickname;
            
            if (userData.isAdmin) {
                document.querySelectorAll('.admin-only').forEach(el => el.classList.add('visible'));
                await carregarRecrutasPendentes();
            }
            
            const avisos = await avisosRes.json();
            const avisosGridEl = document.getElementById('avisos-grid');
            if(avisosGridEl) avisosGridEl.innerHTML = avisos.length > 0 ? avisos.map(aviso => `<div class="aviso-card"><h4>${aviso.titulo}</h4><p>${aviso.conteudo}</p><p class="autor">Por: ${aviso.autor || 'Liderança'}</p></div>`).join('') : '<p>Nenhum aviso.</p>';

            const membros = await membrosRes.json();
            const membrosListEl = document.getElementById('membros-list');
            if (membrosListEl) {
                membrosListEl.innerHTML = membros.length > 0 ? membros.map(m => `<li>${m.nickname}</li>`).join('') : '<li>Nenhum membro.</li>';
            }

        } catch (error) {
            console.error('Falha ao carregar dados do dashboard:', error);
            showNotification(error.message || 'Sua sessão pode ter expirado.', 'error');
            setTimeout(() => window.location.href = '/login.html', 3000);
        }
    }

    carregarDadosIniciais();
});