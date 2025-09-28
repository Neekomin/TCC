document.addEventListener('DOMContentLoaded', () => {
    // --- Variáveis de API e Seletores ---
    const REALMS_URL = 'https://ddragon.leagueoflegends.com/realms/br.json'; // Pega a versão do patch do servidor BR
    const BASE_DDRAGON_URL = 'https://ddragon.leagueoflegends.com/cdn/';
    const itemListContainer = document.getElementById('item-list');
    const championListContainer = document.getElementById('campeoes-section');
    const mainElement = document.querySelector('main'); 

    let currentDDragonVersion = '';
    let championDataCache = {}; // Cache para armazenar dados completos dos campeões
    let allItemsData = []; // Armazenar todos os dados dos itens aqui
    let allChampionsData = []; // Armazenar todos os dados dos campeões aqui

    // --- Mapa de Tradução de Classes (Tags) ---
    const TAGS_TRANSLATION = {
        'Fighter': 'Lutador',
        'Tank': 'Tanque',
        'Mage': 'Mago',
        'Assassin': 'Assassino',
        'Support': 'Suporte',
        'Marksman': 'Atirador'
    };

    // --- Lógica de Navegação SPA ---
    const navButtons = document.querySelectorAll('.nav-button');
    const contentSections = document.querySelectorAll('.content-section');
    
    // Desbloqueia o botão de Campeões ao carregar o script
    const campeoesButton = document.querySelector('.nav-button[data-target="campeoes-section"]');
    if (campeoesButton) {
        campeoesButton.disabled = false;
        campeoesButton.textContent = 'Campeões'; // Remove o texto "(Em Breve)"
    }

    function hideAllSections() {
        contentSections.forEach(section => {
            section.style.display = 'none';
        });
        // Esconde também a seção de detalhes do campeão, se estiver visível
        const detailSection = document.getElementById('champion-detail-section');
        if (detailSection) {
            detailSection.style.display = 'none';
        }
    }

    function showSection(targetId) {
        hideAllSections();

        // 2. Mostra a seção desejada
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.style.display = 'block';
        }

        // 3. Atualiza o estado "ativo" dos botões
        navButtons.forEach(button => {
            button.classList.remove('active');
            if (button.getAttribute('data-target') === targetId) {
                button.classList.add('active');
            }
        });
        
        // 4. Se for uma seção de API, carrega os dados (se ainda não o fez)
        if (targetId === 'itens-section' && !targetSection.getAttribute('data-loaded')) {
            if (currentDDragonVersion) {
                loadItems(currentDDragonVersion);
                targetSection.setAttribute('data-loaded', 'true');
            } else {
                getLatestVersionAndLoadAPI(targetSection, 'item');
            }
        }
        
        if (targetId === 'campeoes-section' && !targetSection.getAttribute('data-loaded')) {
            if (currentDDragonVersion) {
                loadChampions(currentDDragonVersion);
                targetSection.setAttribute('data-loaded', 'true');
            } else {
                getLatestVersionAndLoadAPI(targetSection, 'champion');
            }
        }
    }

    // Adiciona o Event Listener (ouvinte de evento) para cada botão
    navButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const targetId = event.currentTarget.getAttribute('data-target');
            
            if (!event.currentTarget.disabled) {
                showSection(targetId);
            } else {
                alert("A seção " + event.currentTarget.textContent.split('(')[0].trim() + " está em desenvolvimento!");
            }
        });
    });

    // --- Lógica da API ---

    // Função auxiliar para limpar tags HTML da descrição da API
    function cleanDescription(description) {
        return description.replace(/<[^>]*>/g, '').trim();
    }

    // Traduz a lista de tags
    function translateTags(tags) {
        return tags.map(tag => TAGS_TRANSLATION[tag] || tag).join(' / ');
    }
    
    // 1. Busca a versão mais recente do DDragon e carrega o conteúdo
    async function getLatestVersionAndLoadAPI(targetSection, dataType) {
        let loadingText = dataType === 'item' ? 'itens' : 'campeões';
        let container = dataType === 'item' ? itemListContainer : championListContainer;

        container.innerHTML = `<h2>Buscando a versão mais recente do jogo para ${loadingText}...</h2>`;

        try {
            const response = await fetch(REALMS_URL);
            const data = await response.json();
            
            currentDDragonVersion = data.n.item; // Pega a versão mais recente
            
            // Depois de obter a versão, carrega o conteúdo específico
            if (dataType === 'item') {
                loadItems(currentDDragonVersion);
            } else if (dataType === 'champion') {
                loadChampions(currentDDragonVersion);
            }
            
            targetSection.setAttribute('data-loaded', 'true');
            
        } catch (error) {
            console.error('Erro ao buscar a versão da API:', error);
            container.innerHTML = `<h2>Erro ao Carregar ${loadingText.toUpperCase()}</h2><p>Não foi possível obter a versão mais recente do jogo. Tente novamente mais tarde.</p>`;
        }
    }


    // 2. Busca e exibe TODOS os itens
    async function loadItems(version) {
        const ITEM_DATA_URL = `${BASE_DDRAGON_URL}${version}/data/pt_BR/item.json`;

        itemListContainer.innerHTML = `<h2>Carregando TODOS os Itens (Versão: ${version})...</h2>`; 

        try {
            const response = await fetch(ITEM_DATA_URL);
            const data = await response.json();
            
            // Conjunto para rastrear nomes de itens já adicionados
            const uniqueNames = new Set();
            
            // FILTROS APLICADOS (mapa, preço > 0 e UNICIDADE por nome):
            allItemsData = Object.values(data.data)
                .filter(item => item.maps && item.maps["11"]) // Filtra por itens do mapa Summoner's Rift
                .filter(item => item.gold && item.gold.total > 0) // Filtra por itens que custam mais que 0
                // FILTRO DE DUPLICATAS: Garante que apenas 1 item com o mesmo nome seja incluído
                .filter(item => {
                    if (uniqueNames.has(item.name)) {
                        return false; // É um duplicado, descartar
                    } else {
                        uniqueNames.add(item.name);
                        return true; // Nome novo, manter
                    }
                });

            // Renderiza com a ordenação padrão (A-Z)
            renderItems(allItemsData, version, 'alphabetical-asc');

            // Adiciona listener de eventos de ordenação APENAS depois de carregar os dados
            setupItemSorting(version);

        } catch (error) {
            console.error('Erro ao buscar dados dos itens:', error);
            itemListContainer.innerHTML = '<h2>Erro ao Carregar Itens</h2><p>Não foi possível buscar os dados dos itens com a versão atual.</p>';
        }
    }
    
    // 3. Configura os botões de ordenação e seus eventos para Itens
    function setupItemSorting(version) {
        // Remove controles anteriores para evitar duplicação (especialmente se o usuário navegar e voltar)
        const existingControls = itemListContainer.querySelector('#sort-options-container');
        if(existingControls) existingControls.remove();
        
        // Opção Z-A adicionada
        const sortControlsHtml = `
            <div id="sort-options-container" style="margin-bottom: 20px; padding: 15px; border: 1px dashed var(--cor-secundaria); border-radius: 5px; background-color: #252541;">
                <h3 style="color: var(--cor-destaque); margin-bottom: 10px; font-size: 1.2em;">Ordenar Itens:</h3>
                <div id="sort-options" style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <button class="nav-button sort-button" data-sort="alphabetical-asc">Nome (A-Z)</button>
                    <button class="nav-button sort-button" data-sort="alphabetical-desc">Nome (Z-A)</button>
                    <button class="nav-button sort-button" data-sort="value-asc">Valor (Crescente)</button>
                    <button class="nav-button sort-button" data-sort="value-desc">Valor (Decrescente)</button>
                </div>
            </div>
        `;

        // Insere os controles de ordenação logo abaixo do título
        const existingTitle = itemListContainer.querySelector('h2');
        if (existingTitle) {
            existingTitle.insertAdjacentHTML('afterend', sortControlsHtml);
        } else {
            itemListContainer.insertAdjacentHTML('afterbegin', sortControlsHtml);
        }

        // Adiciona o Event Listener nos novos botões
        document.querySelectorAll('.sort-button').forEach(button => {
            button.addEventListener('click', (event) => {
                const sortType = event.currentTarget.getAttribute('data-sort');
                renderItems(allItemsData, version, sortType);
                
                // Atualiza o visual dos botões de ordenação
                document.querySelectorAll('.sort-button').forEach(btn => btn.classList.remove('active'));
                event.currentTarget.classList.add('active');
            });
        });
        
        // Ativa o botão de ordenação padrão (A-Z)
        document.querySelector('.sort-button[data-sort="alphabetical-asc"]').classList.add('active');
    }

    // 4. Aplica a ordenação e renderiza o HTML dos itens
    function renderItems(items, version, sortType) {
        const ITEM_IMAGE_URL = `${BASE_DDRAGON_URL}${version}/img/item/`;
        let sortedItems = [...items]; // Cria uma cópia para ordenar

        switch (sortType) {
            case 'value-asc':
                sortedItems.sort((a, b) => (a.gold?.total || 0) - (b.gold?.total || 0));
                break;
            case 'value-desc':
                sortedItems.sort((a, b) => (b.gold?.total || 0) - (a.gold?.total || 0));
                break;
            case 'alphabetical-desc':
                sortedItems.sort((a, b) => b.name.localeCompare(a.name)); // Z-A
                break;
            case 'alphabetical-asc':
            default:
                sortedItems.sort((a, b) => a.name.localeCompare(b.name)); // A-Z
                break;
        }

        let itemsHtml = '';
        sortedItems.forEach(item => {
            const imageUrl = ITEM_IMAGE_URL + item.image.full;
            const summary = cleanDescription(item.description);
            const plaintext = item.plaintext || 'Sem estatísticas detalhadas disponíveis.';
            // Garante que o item.gold existe antes de tentar acessar .total
            const goldTotal = item.gold && item.gold.total ? item.gold.total : 'N/A';
            const goldInfo = goldTotal !== 'N/A' ? `Custo Total: ${goldTotal} de Ouro` : 'Custo não especificado.';

            itemsHtml += `
                <div class="item-card">
                    <div class="item-header">
                        <img src="${imageUrl}" alt="Ícone ${item.name}" class="item-icon" onerror="this.onerror=null; this.src='https://via.placeholder.com/32x32?text=NA'">
                        <h3>${item.name}</h3>
                    </div>
                    <div class="item-details">
                        <p class="item-summary">
                            ${summary}
                        </p>
                        <div class="item-stats">
                            <p><strong>Efeitos Principais:</strong></p>
                            <p>${plaintext}</p>
                            <p style="margin-top: 10px;">${goldInfo}</p>
                        </div>
                    </div>
                </div>
            `;
        });
        
        // Garante que o container #item-list só tenha os itens e o título e controles de ordenação (se já existirem)
        let contentOnlyContainer = document.getElementById('item-list-content');
        if (!contentOnlyContainer) {
            itemListContainer.insertAdjacentHTML('beforeend', `<div id="item-list-content"></div>`);
            contentOnlyContainer = document.getElementById('item-list-content');
        }
        contentOnlyContainer.innerHTML = itemsHtml;
        
        // Atualiza o título (caso tenha sido sobrescrito)
        const currentTitle = itemListContainer.querySelector('h2');
        if (currentTitle) {
            currentTitle.textContent = `Catálogo Completo de Itens (Total: ${items.length}, Versão ${version})`;
        } else {
            itemListContainer.insertAdjacentHTML('afterbegin', `<h2>Catálogo Completo de Itens (Total: ${items.length}, Versão ${version})</h2>`);
        }
    }


    // 5. Busca e exibe a lista COMPLETA de Campeões (Lista inicial)
    async function loadChampions(version) {
        const CHAMPION_DATA_URL = `${BASE_DDRAGON_URL}${version}/data/pt_BR/champion.json`;

        championListContainer.innerHTML = `<h2>Carregando Lista Completa de Campeões (Versão: ${version})...</h2>`;

        try {
            const response = await fetch(CHAMPION_DATA_URL);
            const data = await response.json();
            
            // Armazena os dados brutos
            allChampionsData = Object.values(data.data);

            // Renderiza com a ordenação padrão (A-Z) e filtro 'all'
            renderChampionList(allChampionsData, version, 'alphabetical-asc', 'all');

            // Adiciona listener de eventos de ordenação e filtro
            setupChampionSorting(version);

        } catch (error) {
            console.error('Erro ao buscar dados dos campeões:', error);
            championListContainer.innerHTML = '<h2>Erro ao Carregar Campeões</h2><p>Não foi possível buscar os dados dos campeões com a versão atual.</p>';
        }
    }

    // 6. Configura os controles de Filtro e Ordenação para Campeões
    function setupChampionSorting(version) {
        // Remove controles anteriores para evitar duplicação
        const existingControls = championListContainer.querySelector('#champion-filter-and-sort-container');
        if(existingControls) existingControls.remove();
        
        // Geração das opções de filtro de classe dinamicamente
        const classOptions = Object.entries(TAGS_TRANSLATION)
            .map(([key, value]) => `<option value="${key}">${value}</option>`)
            .join('');
        
        // Controles de Filtro (Select) e Ordenação (Botão de Nome)
        // Opção Z-A adicionada
        const filterAndSortControlsHtml = `
            <div id="champion-filter-and-sort-container" style="margin-bottom: 20px; padding: 15px; border: 1px dashed var(--cor-secundaria); border-radius: 5px; background-color: #2e354a;">
                <h3 style="color: var(--cor-destaque); margin-bottom: 10px; font-size: 1.2em;">Filtros e Ordenação:</h3>
                <div style="display: flex; gap: 15px; flex-wrap: wrap; align-items: center;">
                    
                    <label for="champion-class-filter" style="color: var(--cor-texto);">Filtrar por Classe:</label>
                    <select id="champion-class-filter" class="nav-button" style="padding: 10px; border-radius: 5px; background-color: var(--cor-secundaria); color: var(--cor-texto); border: none; cursor: pointer;">
                        <option value="all">Todas as Classes</option>
                        ${classOptions}
                    </select>

                    <button class="nav-button champion-sort-button" data-sort="alphabetical-asc">Nome (A-Z)</button>
                    <button class="nav-button champion-sort-button" data-sort="alphabetical-desc">Nome (Z-A)</button>
                </div>
            </div>
        `;

        // Insere os controles de ordenação logo abaixo do título
        const existingTitle = championListContainer.querySelector('h2');
        if (existingTitle) {
            existingTitle.insertAdjacentHTML('afterend', filterAndSortControlsHtml);
        } else {
            championListContainer.insertAdjacentHTML('afterbegin', filterAndSortControlsHtml);
        }

        // Adiciona Event Listener no SELECT (Filtro)
        document.getElementById('champion-class-filter').addEventListener('change', (event) => {
            const filterClass = event.target.value;
            // Mantém a ordenação atual (ou padrão A-Z)
            const currentSort = document.querySelector('.champion-sort-button.active')?.getAttribute('data-sort') || 'alphabetical-asc';
            renderChampionList(allChampionsData, version, currentSort, filterClass);
        });

        // Adiciona Event Listener nos botões de ordenação (Nome A-Z e Z-A)
        document.querySelectorAll('.champion-sort-button').forEach(button => {
            button.addEventListener('click', (event) => {
                const sortType = event.currentTarget.getAttribute('data-sort');
                const currentFilter = document.getElementById('champion-class-filter').value;
                renderChampionList(allChampionsData, version, sortType, currentFilter);
                
                // Atualiza o visual dos botões de ordenação
                document.querySelectorAll('.champion-sort-button').forEach(btn => btn.classList.remove('active'));
                event.currentTarget.classList.add('active');
            });
        });
        
        // Ativa o botão de ordenação padrão (A-Z) ao carregar
        document.querySelector('.champion-sort-button[data-sort="alphabetical-asc"]').classList.add('active');
    }

    // 7. Renderiza o grid de campeões e adiciona o evento de clique
    function renderChampionList(champions, version, sortType, filterClass = 'all') {
        const CHAMPION_SQUARE_IMAGE_URL = `${BASE_DDRAGON_URL}${version}/img/champion/`;
        let filteredChampions = [...champions];

        // 1. FILTRAGEM POR CLASSE
        if (filterClass !== 'all') {
            // Filtra o array para incluir apenas campeões que contenham a classe selecionada em suas tags
            filteredChampions = filteredChampions.filter(champion => champion.tags.includes(filterClass));
        }

        // 2. ORDENAÇÃO
        switch (sortType) {
            case 'alphabetical-desc':
                filteredChampions.sort((a, b) => b.name.localeCompare(a.name)); // Z-A
                break;
            case 'alphabetical-asc':
            default:
                filteredChampions.sort((a, b) => a.name.localeCompare(b.name)); // A-Z
                break;
        }


        let championsHtml = `
            <div id="champion-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 20px; text-align: center;">
        `;
        
        // Caso não haja campeões após a filtragem
        if (filteredChampions.length === 0) {
            championsHtml = `<p style="text-align: center; color: var(--cor-secundaria); font-size: 1.2em;">Nenhum campeão encontrado para a classe selecionada.</p>`;
        } else {
            filteredChampions.forEach(champion => {
                const imageUrl = CHAMPION_SQUARE_IMAGE_URL + champion.image.full;
                const translatedTags = translateTags(champion.tags);

                // Adicionamos data-id para identificar qual campeão foi clicado
                championsHtml += `
                    <div class="champion-card" data-id="${champion.id}" style="background-color: #2e354a; padding: 10px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5); transition: transform 0.2s; cursor: pointer;">
                        <img src="${imageUrl}" alt="${champion.name}" style="width: 100px; height: 100px; border-radius: 50%; border: 3px solid var(--cor-destaque);">
                        <h4 style="color: var(--cor-destaque); margin-top: 10px; margin-bottom: 5px;">${champion.name}</h4>
                        <p style="font-size: 0.9em; color: #a9b7d6;">${translatedTags}</p>
                        <p style="font-size: 0.8em; color: #7f8c8d; margin-top: 5px;">${champion.title}</p>
                    </div>
                `;
            });

            championsHtml += '</div>';
        }


        // Remove o grid anterior (se existir) para evitar duplicação
        const existingGrid = championListContainer.querySelector('#champion-grid');
        if (existingGrid) existingGrid.remove();

        // Atualiza o título para refletir o filtro atual
        const currentTitle = championListContainer.querySelector('h2');
        const filterName = filterClass === 'all' ? 'Todos os Campeões' : TAGS_TRANSLATION[filterClass] || filterClass;
        
        if (currentTitle) {
            currentTitle.textContent = `Lista de Campeões: ${filterName} (Total: ${filteredChampions.length}, Versão ${version})`;
        } else {
            championListContainer.insertAdjacentHTML('afterbegin', `<h2>Lista de Campeões: ${filterName} (Total: ${filteredChampions.length}, Versão ${version})</h2>`);
        }
        
        // Adiciona o novo HTML do grid
        championListContainer.insertAdjacentHTML('beforeend', championsHtml);
        
        championListContainer.style.background = 'var(--cor-card-fundo)';
        championListContainer.style.padding = '30px';
        championListContainer.style.borderRadius = '8px';
        
        // Adiciona o Event Listener nos cards após a renderização
        document.querySelectorAll('.champion-card').forEach(card => {
            card.addEventListener('click', (event) => {
                const championId = event.currentTarget.getAttribute('data-id');
                loadChampionDetail(championId, version);
            });
        });
    }


    // 8. Carrega a página de detalhes de um campeão
    async function loadChampionDetail(championId, version) {
        // Verifica o cache primeiro
        if (championDataCache[championId]) {
            renderChampionDetail(championDataCache[championId], version);
            return;
        }

        const CHAMPION_DETAIL_URL = `${BASE_DDRAGON_URL}${version}/data/pt_BR/champion/${championId}.json`;
        
        // Crie ou selecione a seção de detalhes
        let detailSection = document.getElementById('champion-detail-section');
        if (!detailSection) {
            detailSection = document.createElement('section');
            detailSection.id = 'champion-detail-section';
            detailSection.className = 'content-section';
            detailSection.style.marginTop = '30px';
            detailSection.style.background = 'var(--cor-card-fundo)';
            detailSection.style.padding = '30px';
            detailSection.style.borderRadius = '8px';
            detailSection.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
            mainElement.appendChild(detailSection);
        }

        detailSection.innerHTML = `<h2>Carregando Detalhes de ${championId}...</h2>`;
        hideAllSections(); // Esconde a lista
        detailSection.style.display = 'block'; // Mostra o carregamento

        try {
            const response = await fetch(CHAMPION_DETAIL_URL);
            const data = await response.json();
            const champion = Object.values(data.data)[0]; // Pega o único campeão do objeto

            championDataCache[championId] = champion; // Armazena no cache
            renderChampionDetail(champion, version);

        } catch (error) {
            console.error(`Erro ao buscar detalhes do campeão ${championId}:`, error);
            detailSection.innerHTML = `<h2>Erro ao Carregar Detalhes</h2><p>Não foi possível carregar as informações detalhadas de ${championId}.</p>`;
        }
    }

    // 9. Renderiza a página de detalhes do campeão
    function renderChampionDetail(champion, version) {
        const CHAMPION_SPLASH_IMAGE_URL = `${BASE_DDRAGON_URL}img/champion/splash/${champion.id}_0.jpg`;
        const translatedTags = translateTags(champion.tags);

        // Barra de Estrelas de Dificuldade
        const renderStars = (stat) => '⭐'.repeat(stat);
        
        // Função para voltar para a lista
        const backButtonHtml = `
            <button id="back-to-list" class="nav-button" style="margin-bottom: 20px; background-color: var(--cor-secundaria); color: var(--cor-texto); border-color: var(--cor-secundaria);">
                ← Voltar para a Lista de Campeões
            </button>
        `;

        const detailHtml = `
            ${backButtonHtml}
            <div style="background: url('${CHAMPION_SPLASH_IMAGE_URL}'); background-size: cover; background-position: center top; padding: 40px; border-radius: 6px; box-shadow: inset 0 0 0 2000px rgba(0, 0, 0, 0.5);">
                <h1 style="color: var(--cor-destaque); font-size: 3em;">${champion.name}</h1>
                <h3 style="color: #a9b7d6; font-style: italic;">"${champion.title}"</h3>
            </div>

            <div style="display: flex; gap: 30px; margin-top: 30px;">
                <div style="flex: 2;">
                    <h2>Lore / História</h2>
                    <p style="text-align: justify; margin-bottom: 20px;">${champion.lore}</p>
                    
                    <h3>Classes:</h3>
                    <p style="font-weight: bold; color: var(--cor-secundaria);">${translatedTags}</p>
                </div>
                
                <div style="flex: 1; background-color: #2e354a; padding: 20px; border-radius: 6px; border: 1px solid var(--cor-destaque);">
                    <h3>Estatísticas Principais</h3>
                    <p>Ataque: ${renderStars(champion.info.attack)}</p>
                    <p>Defesa: ${renderStars(champion.info.defense)}</p>
                    <p>Habilidade: ${renderStars(champion.info.magic)}</p>
                    <p>Dificuldade: ${renderStars(champion.info.difficulty)}</p>
                    
                    <h3 style="margin-top: 20px;">Dicas de Jogo</h3>
                    <ul>
                        ${champion.allytips.map(tip => `<li style="margin-bottom: 5px; list-style-type: '⚡ ';">${tip}</li>`).join('')}
                    </ul>
                </div>
            </div>
            ${backButtonHtml}
        `;

        const detailSection = document.getElementById('champion-detail-section');
        detailSection.innerHTML = detailHtml;
        
        // Adiciona o Event Listener ao botão de Voltar
        document.querySelectorAll('#back-to-list').forEach(button => {
            button.addEventListener('click', () => showSection('campeoes-section'));
        });
    }

    
    // --- Interatividade Adicional: Link de Campeões na Seção Runeterra ---
    const campeoesLink = document.getElementById('campeoes-link-img');
    if (campeoesLink) {
        campeoesLink.addEventListener('click', (event) => {
            event.preventDefault();
            const campeoesButton = document.querySelector('.nav-button[data-target="campeoes-section"]');
            if (campeoesButton) {
                campeoesButton.click(); 
            }
        });
    }

    // NOVO: Interatividade para o Link de Itens na Seção Runeterra
    const itensLink = document.getElementById('itens-link-img');
    if (itensLink) {
        itensLink.addEventListener('click', (event) => {
            event.preventDefault();
            const targetId = event.currentTarget.getAttribute('data-target'); // Pega 'itens-section'
            const itensButton = document.querySelector(`.nav-button[data-target="${targetId}"]`);
            
            // Simula o clique no botão principal de navegação de Itens
            if (itensButton) {
                itensButton.click(); 
            }
        });
    }
    
    // Mostra a seção inicial ao carregar a página
    showSection('runeterra-section');
});