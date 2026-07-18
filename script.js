// API: https://www.dnd5eapi.co/api/2014/monsters

let isModalOpen = false;
let contrastToggle = false;
const scaleFactor = 1/20;
let monsterCache = [];
let monsterDetailCache = {};
let currentPage = 0;
const pageSize = 50;
let currentSortOption = 'name';
let searchTimeout;

function toggleContrast() {
    contrastToggle = !contrastToggle
    if (contrastToggle) {
        document.body.classList += " dark-theme"
    }
    else {
        document.body.classList.remove("dark-theme")
    }
    
}

function toggleModal() {
    if (isModalOpen) {
        isModalOpen = false;
        return document.body.classList.remove("modal--open");
    }
    isModalOpen = true;
    document.body.classList += " modal--open";
}

async function fetchMonsters() {
    if (monsterCache.length) return monsterCache;
    const res = await fetch("https://www.dnd5eapi.co/api/monsters");
    const data = await res.json();
    monsterCache = data.results;
    return monsterCache;
}

async function fetchCreatureDetails(index) {
    if (monsterDetailCache[index]) {
        return monsterDetailCache[index];
    }

    try {
        const res = await fetch(`https://www.dnd5eapi.co/api/monsters/${index}`);
        const data = await res.json();
        monsterDetailCache[index] = data;
        return data;
    } catch (error) {
        console.error(`Error fetching creature details for ${index}:`, error);
        return null;
    }
}

function scoreCreatureName(name, query) {
    const normalizedName = name.toLowerCase();
    const normalizedQuery = query.toLowerCase();

    if (normalizedName === normalizedQuery) return 100;
    if (normalizedName.startsWith(normalizedQuery)) return 90;
    if (normalizedName.includes(normalizedQuery)) return 75;
    const words = normalizedName.split(' ');
    if (words.some(word => word.startsWith(normalizedQuery))) return 60;
    return 0;
}

async function findCreatureMatches(query, maxResults = 50) {
    const monsters = await fetchMonsters();
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    return monsters
        .map(monster => ({
            ...monster,
            score: scoreCreatureName(monster.name, normalizedQuery)
        }))
        .filter(result => result.score > 0)
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .slice(0, maxResults);
}

async function renderSearchResults(query) {
    const creatureList = document.getElementById('creature-list');
    const loadMoreRow = document.querySelector('.load-more-row');
    creatureList.innerHTML = '';
    const trimmedQuery = query.trim();

    if (trimmedQuery) {
        if (loadMoreRow) {
            loadMoreRow.style.display = 'none';
        }

        setLoadingState(true, false);
        const matches = await findCreatureMatches(trimmedQuery, 50);

        if (!matches.length) {
            creatureList.innerHTML = '<p class="no-results">No creatures found.</p>';
            setLoadingState(false, false);
            return;
        }

        const details = await Promise.all(matches.map(match => fetchCreatureDetails(match.index)));
        creatureList.innerHTML = details.filter(Boolean).map(createCreatureCard).join('');
        setLoadingState(false, false);
    } else {
        if (loadMoreRow) {
            loadMoreRow.style.display = 'flex';
        }
        await renderLoadedPages();
    }
}

function getCreatureSortComparator(option) {
    switch (option) {
        case 'cr-asc':
            return (a, b) => (a.challenge_rating || 0) - (b.challenge_rating || 0);
        case 'cr-desc':
            return (a, b) => (b.challenge_rating || 0) - (a.challenge_rating || 0);
        case 'hp-asc':
            return (a, b) => (a.hit_points || 0) - (b.hit_points || 0);
        case 'hp-desc':
            return (a, b) => (b.hit_points || 0) - (a.hit_points || 0);
        case 'name':
        default:
            return (a, b) => a.name.localeCompare(b.name);
    }
}

function sortCreatureDetails(details, option = currentSortOption) {
    const sortedDetails = [...details];
    sortedDetails.sort(getCreatureSortComparator(option));
    return sortedDetails;
}

async function renderLoadedPages(sortOption = currentSortOption) {
    const creatureList = document.getElementById('creature-list');
    creatureList.innerHTML = '';

    const loadedMonsterCount = (currentPage + 1) * pageSize;
    const monsters = monsterCache.slice(0, loadedMonsterCount);
    const details = await Promise.all(monsters.map(monster => fetchCreatureDetails(monster.index)));
    const sortedDetails = sortCreatureDetails(details.filter(Boolean), sortOption);

    creatureList.innerHTML = sortedDetails.map(createCreatureCard).join('');
}

async function updateCreatureListDisplay() {
    const searchInput = document.getElementById('creature-search-input');
    if (searchInput?.value.trim()) {
        return;
    }
    await renderLoadedPages(currentSortOption);
}

function capitalizeAlignment(alignment) {
    if (!alignment) return 'Unknown';
    return alignment
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

function createCreatureCard(creature) {
    const ac = creature.armor_class?.[0]?.value || creature.armor_class || 'N/A';
    const hpFormula = creature.hit_points_roll || '';
    const hpDisplay = creature.hit_points ? `${creature.hit_points}${hpFormula ? ` (${hpFormula})` : ''}` : 'N/A';
    const speed = creature.speed?.walk ? `${creature.speed.walk} ft.` : 'N/A';
    const alignment = capitalizeAlignment(creature.alignment);
    
    return `
        <div class="creature">
            <h2 class="creature__name">${creature.name}</h2>
            <p class="creature__alignment">${alignment}</p>
            <div class="gradient"></div>
            <div class="creature__features">
                <p class="creature__feature">Armor Class: ${ac}</p>
                <p class="creature__feature">Hit Points: ${hpDisplay}</p>
                <p class="creature__feature">Speed: ${speed}</p>
                <p class="creature__feature">Challenge Rating: ${creature.challenge_rating || 'N/A'}</p>
            </div>
            <div class="gradient"></div>
            <div class="creature__stats">
                <ul class="creature__stats--names">
                    <li class="creature__stat--name stat--name-str">STR</li>
                    <li class="creature__stat--name stat--name-dex">DEX</li>
                    <li class="creature__stat--name stat--name-con">CON</li>
                    <li class="creature__stat--name stat--name-int">INT</li>
                    <li class="creature__stat--name stat--name-wis">WIS</li>
                    <li class="creature__stat--name stat--name-cha">CHA</li>
                </ul>
                <ul class="creature__stats--values">
                    <li class="creature__stat--value">${creature.strength || 10}</li>
                    <li class="creature__stat--value">${creature.dexterity || 10}</li>
                    <li class="creature__stat--value">${creature.constitution || 10}</li>
                    <li class="creature__stat--value">${creature.intelligence || 10}</li>
                    <li class="creature__stat--value">${creature.wisdom || 10}</li>
                    <li class="creature__stat--value">${creature.charisma || 10}</li>
                </ul>
                <ul class="creature__stats--modifiers">
                    <li class="creature__stat--modifier">${getModifier(creature.strength)}</li>
                    <li class="creature__stat--modifier">${getModifier(creature.dexterity)}</li>
                    <li class="creature__stat--modifier">${getModifier(creature.constitution)}</li>
                    <li class="creature__stat--modifier">${getModifier(creature.intelligence)}</li>
                    <li class="creature__stat--modifier">${getModifier(creature.wisdom)}</li>
                    <li class="creature__stat--modifier">${getModifier(creature.charisma)}</li>
                </ul>
            </div>
            <div class="gradient"></div>
            <a href="">
                <button class="creature__view-btn">View Full Stat Block</button>
            </a>
        </div>
    `;
}

function getModifier(statValue) {
    const stat = statValue || 10;
    const modifier = Math.floor((stat - 10) / 2);
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

function setLoadingState(isLoading, hideList = false) {
    const loader = document.getElementById('creature-loader');
    const creatureList = document.getElementById('creature-list');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const loadMoreRow = loadMoreBtn?.closest('.load-more-row');

    if (loader) {
        loader.style.display = isLoading ? 'block' : 'none';
    }
    if (creatureList) {
        if (isLoading && hideList) {
            creatureList.style.display = 'none';
            creatureList.classList.remove('loaded');
        } else {
            creatureList.style.display = 'grid';
            if (!isLoading) {
                requestAnimationFrame(() => {
                    creatureList.classList.add('loaded');
                });
            }
        }
    }
    if (loadMoreRow) {
        if (isLoading && hideList) {
            loadMoreRow.style.display = 'none';
        } else {
            loadMoreRow.style.display = 'flex';
        }
    }
    if (loadMoreBtn) {
        loadMoreBtn.disabled = isLoading;
    }
}

async function loadCreaturePage(page) {
    const monsters = await fetchMonsters();
    const start = page * pageSize;
    const pageItems = monsters.slice(start, start + pageSize);
    const creatureList = document.getElementById('creature-list');
    const isLastPage = start + pageSize >= monsters.length;

    if (!pageItems.length) {
        return { hasItems: false, isLastPage: true };
    }

    const detailedPage = await Promise.all(
        pageItems.map(async monster => await fetchCreatureDetails(monster.index))
    );

    const creatureCards = detailedPage
        .filter(Boolean)
        .map(createCreatureCard)
        .join('');

    creatureList.innerHTML += creatureCards;

    return { hasItems: true, isLastPage };
}

function hideLoadMoreButton() {
    const loadMoreRow = document.querySelector('.load-more-row');
    if (loadMoreRow) {
        loadMoreRow.style.display = 'none';
    }
}

async function loadCreatures() {
    currentPage = 0;
    const creatureList = document.getElementById('creature-list');
    creatureList.innerHTML = '';
    setLoadingState(true, true);
    const result = await loadCreaturePage(currentPage);
    setLoadingState(false, true);
    await updateCreatureListDisplay();
    if (!result.hasItems || result.isLastPage) {
        hideLoadMoreButton();
    }
}

async function loadMoreCreatures() {
    currentPage += 1;
    setLoadingState(true, false);
    const result = await loadCreaturePage(currentPage);
    setLoadingState(false, false);
    await updateCreatureListDisplay();
    if (!result.hasItems || result.isLastPage) {
        hideLoadMoreButton();
    }
}

function handleSortChange(event) {
    currentSortOption = event.target.value || 'name';
    const searchInput = document.getElementById('creature-search-input');
    if (!searchInput?.value.trim()) {
        renderLoadedPages(currentSortOption);
    }
}

// Load creatures on page load
document.addEventListener('DOMContentLoaded', () => {
    loadCreatures();
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMoreCreatures);
    }

    const searchInput = document.getElementById('creature-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', event => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                renderSearchResults(event.target.value);
            }, 250);
        });

        searchInput.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                clearTimeout(searchTimeout);
                renderSearchResults(event.target.value);
            }
        });
    }

    const sortSelect = document.querySelector('.creature__sort--select');
    if (sortSelect) {
        sortSelect.addEventListener('change', handleSortChange);
    }
});