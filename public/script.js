// API Configuration
const API_BASE_URL = window.location.origin + '/api';

// State
let currentUser = null;
let nominations = [];
let candidates = {}; // { nomination_id: [candidates] }
let authMode = 'login'; // 'login' or 'register'
let resultsUnlocked = false;

// Event date (change this to your event date)
const eventDate = new Date('2025-12-19T18:00:00').getTime();

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initCountdown();
    initAuth();
    initNominations();
    initResults();
    initMobileMenu();
    checkAuthStatus();
});

// API Helper Functions
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text.substring(0, 200));
            throw new Error(`Server returned non-JSON response: ${response.status}`);
        }

        const data = await response.json();

        if (!response.ok) {
            // Handle string or object error payloads
            const message = typeof data?.error === 'string'
                ? data.error
                : (data?.error?.message || `HTTP error! status: ${response.status}`);
            throw new Error(message);
        }

        return data;
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// Auth Functions
async function checkAuthStatus() {
    const token = localStorage.getItem('token');
    if (!token) {
        updateAuthUI(false);
        return;
    }

    try {
        const user = await apiRequest('/auth/me');
        currentUser = user;
        updateAuthUI(true, user);
        await loadUserVotes();
    } catch (error) {
        localStorage.removeItem('token');
        updateAuthUI(false);
    }
}

function updateAuthUI(isAuthenticated, user = null) {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const adminBtn = document.getElementById('admin-btn');
    const userInfo = document.getElementById('user-info');
    const votingForm = document.getElementById('voting-form');
    const authRequiredMessage = document.getElementById('auth-required-message');

    if (isAuthenticated && user) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
        if (userInfo) {
            userInfo.style.display = 'inline';
            userInfo.textContent = `Привет, ${user.display_name || user.username}!`;
        }
        // Показать кнопку админа только если пользователь - админ
        if (adminBtn) {
            adminBtn.style.display = (user.is_admin === 1 || user.is_admin === true) ? 'inline-block' : 'none';
        }
        if (votingForm) votingForm.style.display = 'block';
        if (authRequiredMessage) authRequiredMessage.style.display = 'none';
    } else {
        if (loginBtn) loginBtn.style.display = 'inline-block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (adminBtn) adminBtn.style.display = 'none';
        if (userInfo) userInfo.style.display = 'none';
        if (votingForm) votingForm.style.display = 'none';
        if (authRequiredMessage) authRequiredMessage.style.display = 'block';
    }
}

function showAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) {
        console.error('Auth modal not found');
        return;
    }
    modal.classList.add('active');
    switchAuthTab('login');
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    
    modal.classList.remove('active');
    
    const authForm = document.getElementById('auth-form');
    if (authForm) authForm.reset();
    
    const authError = document.getElementById('auth-error');
    if (authError) authError.style.display = 'none';
}

function switchAuthTab(mode) {
    authMode = mode;
    const tabs = document.querySelectorAll('.auth-tab');
    const title = document.getElementById('auth-modal-title');
    const submitBtn = document.getElementById('auth-submit-btn');
    const emailGroup = document.getElementById('email-group');
    const displayNameGroup = document.getElementById('display-name-group');

    if (tabs.length === 0) return;
    
    tabs.forEach(tab => tab.classList.remove('active'));
    
    if (mode === 'login') {
        if (tabs[0]) tabs[0].classList.add('active');
        if (title) title.textContent = 'Вход';
        if (submitBtn) submitBtn.textContent = 'Войти';
        if (emailGroup) emailGroup.style.display = 'none';
        if (displayNameGroup) displayNameGroup.style.display = 'none';
    } else {
        if (tabs[1]) tabs[1].classList.add('active');
        if (title) title.textContent = 'Регистрация';
        if (submitBtn) submitBtn.textContent = 'Зарегистрироваться';
        if (emailGroup) emailGroup.style.display = 'block';
        if (displayNameGroup) displayNameGroup.style.display = 'block';
    }
}

async function handleAuth(event) {
    event.preventDefault();
    const form = event.target;
    const errorDiv = document.getElementById('auth-error');
    if (errorDiv) errorDiv.style.display = 'none';

    const formData = new FormData(form);
    const data = {
        username: formData.get('username'),
        password: formData.get('password')
    };

    if (authMode === 'register') {
        data.email = formData.get('email') || null;
        data.display_name = formData.get('display_name') || null;
    }

    try {
        const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
        const response = await apiRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });

        localStorage.setItem('token', response.token);
        currentUser = response.user;
        updateAuthUI(true, response.user);
        closeAuthModal();
        showModal('Успешно!', authMode === 'login' ? 'Вы успешно вошли в систему!' : 'Регистрация прошла успешно!');
        
        // Reload nominations, votes and user votes
        await loadUserVotes();
        await loadNominations();
    } catch (error) {
        if (errorDiv) {
            errorDiv.textContent = error.message || 'Произошла ошибка. Попробуйте снова.';
            errorDiv.style.display = 'block';
        } else {
            showModal('Ошибка', error.message || 'Произошла ошибка. Попробуйте снова.');
        }
    }
}

function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    updateAuthUI(false);
    nominations = [];
    loadNominations();
    showModal('Выход', 'Вы успешно вышли из системы.');
}

function initAuth() {
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', handleAuth);
    }

    // Close modal on outside click
    const authModal = document.getElementById('auth-modal');
    if (authModal) {
        authModal.addEventListener('click', function(e) {
            if (e.target === authModal) {
                closeAuthModal();
            }
        });
    }
}

// Navigation
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-menu a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId && targetId.startsWith('#')) {
                scrollToSection(targetId.substring(1));
            }
        });
    });
}

function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        const headerHeight = document.querySelector('.header').offsetHeight;
        const sectionPosition = section.offsetTop - headerHeight;
        window.scrollTo({
            top: sectionPosition,
            behavior: 'smooth'
        });
    }
}

// Mobile Menu
function initMobileMenu() {
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (navToggle) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });
    }

    // Close menu when clicking on a link
    const navLinks = document.querySelectorAll('.nav-menu a');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            navMenu.classList.remove('active');
        });
    });
}

// Countdown Timer
function initCountdown() {
    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');
    const eventDateEl = document.getElementById('event-date');

    // Display event date
    if (eventDateEl) {
        const date = new Date(eventDate);
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        eventDateEl.textContent = date.toLocaleDateString('ru-RU', options);
    }

    function updateCountdown() {
        const now = new Date().getTime();
        const distance = eventDate - now;
        const isStarted = distance <= 0;

        if (isStarted) {
            daysEl.textContent = '00';
            hoursEl.textContent = '00';
            minutesEl.textContent = '00';
            secondsEl.textContent = '00';
            if (!resultsUnlocked) {
                resultsUnlocked = true;
                setResultsAvailability(true);
            }
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        daysEl.textContent = String(days).padStart(2, '0');
        hoursEl.textContent = String(hours).padStart(2, '0');
        minutesEl.textContent = String(minutes).padStart(2, '0');
        secondsEl.textContent = String(seconds).padStart(2, '0');
    }

    // Initialize state based on current time
    resultsUnlocked = Date.now() >= eventDate;
    if (resultsUnlocked) {
        setResultsAvailability(true);
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);
}

// Nominations
async function loadNominations() {
    try {
        nominations = await apiRequest('/nominations');
        renderNominations();
        updateNominationSelect();
    } catch (error) {
        console.error('Failed to load nominations:', error);
        showModal('Ошибка', 'Не удалось загрузить номинации. Попробуйте обновить страницу.');
    }
}

function initNominations() {
    loadNominations().then(() => {
        // Update results filter with nominations
        const filter = document.getElementById('results-nomination-filter');
        if (filter && nominations.length > 0) {
            filter.innerHTML = '<option value="">Все номинации</option>';
            nominations.forEach(nom => {
                const option = document.createElement('option');
                option.value = nom.id;
                option.textContent = nom.name;
                filter.appendChild(option);
            });
        }
    });
    loadUserVotes();
}

async function renderNominations() {
    const nominationsGrid = document.getElementById('nominations-grid');
    if (!nominationsGrid) return;

    nominationsGrid.innerHTML = '';
    
    // Load candidates for all nominations
    await loadCandidatesForNominations();
    
    nominations.forEach(nomination => {
        const card = createNominationCard(nomination);
        nominationsGrid.appendChild(card);
    });
}

async function loadCandidatesForNominations() {
    candidates = {};
    
    
    for (const nomination of nominations) {
        try {
            const url = `/candidates?nomination_id=${nomination.id}`;
            
            const nomCandidates = await apiRequest(url);
            candidates[nomination.id] = Array.isArray(nomCandidates) ? nomCandidates : [];
            
        } catch (error) {
            console.error(`❌ Failed to load candidates for nomination ${nomination.id} (${nomination.name}):`, error);
            candidates[nomination.id] = [];
        }
    }
    
    
}

function createNominationCard(nomination) {
    const card = document.createElement('div');
    card.className = 'nomination-card';
    
    const nomCandidates = candidates[nomination.id] || [];
    const userVote = currentUser ? getUserVoteForNomination(nomination.id) : null;
    
    let votingSection = '';
    if (!currentUser) {
        votingSection = `
            <div class="nomination-vote-section">
                <p class="vote-auth-required">Для голосования необходимо <a href="#" onclick="showAuthModal(); return false;">войти</a></p>
            </div>
        `;
    } else if (nomCandidates.length === 0) {
        votingSection = `
            <div class="nomination-vote-section">
                <p class="vote-no-candidates">Кандидаты пока не добавлены</p>
            </div>
        `;
    } else {
        // Find first candidate with video for hover preview
        const firstCandidateWithVideo = nomCandidates.find(c => c.video_url);
        const selectedCandidate = userVote ? nomCandidates.find(c => c.id === userVote.candidate_id) : null;
        
        votingSection = `
            <div class="nomination-vote-section">
                <button class="btn btn-primary btn-block" onclick="openNominationModal(${nomination.id})">
                    ${userVote ? 'Изменить выбор' : 'Выбрать кандидата'}
                </button>
            </div>
        `;
    }
    
    const infoBlock = userVote
        ? `
            <div class="selected-candidate-info">
                <p>Выбран: <strong>${nomCandidates.find(c => c.id === userVote.candidate_id)?.name || 'Неизвестно'}</strong></p>
            </div>
        `
        : `<p class="nomination-description">${nomination.description || ''}</p>`;

    card.innerHTML = `
        <h3>${nomination.name}</h3>
        ${infoBlock}
        ${votingSection}
    `;
    
    return card;
}

// Normalize URL: add leading slash for relative file paths and keep protocol links intact
function normalizeVideoUrl(url) {
    if (!url) return '';
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    // Map legacy /uploads/videos/ to /videos/ (server serves /videos -> uploads/videos)
    if (trimmed.startsWith('/uploads/videos/')) {
        return trimmed.replace(/^\/uploads\/videos\//, '/videos/');
    }

    // Already absolute path
    if (trimmed.startsWith('/')) return trimmed;
    // Treat bare paths (e.g., "videos/clip.mp4") as site-rooted
    return `/${trimmed}`;
}

// Normalize image URL: similar to video URL normalization
function normalizeImageUrl(url) {
    if (!url) return '';
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    // Map legacy /uploads/images/ to /images/ (server serves /images -> uploads/images)
    if (trimmed.startsWith('/uploads/images/')) {
        return trimmed.replace(/^\/uploads\/images\//, '/images/');
    }

    // Already absolute path
    if (trimmed.startsWith('/')) return trimmed;
    // Treat bare paths (e.g., "images/photo.jpg") as site-rooted
    return `/${trimmed}`;
}

// Helper function to get video embed code
function getVideoEmbed(rawUrl) {
    if (!rawUrl) return '';
    const videoUrl = normalizeVideoUrl(rawUrl);
    
    // Twitch (clips and videos)
    // Format: https://www.twitch.tv/videos/VIDEO_ID or https://www.twitch.tv/USERNAME/clip/CLIP_ID
    const twitchVideoRegex = /twitch\.tv\/videos\/(\d+)/;
    const twitchClipRegex = /twitch\.tv\/(?:.*\/)?clip\/([a-zA-Z0-9-]+)/;
    const twitchVideoMatch = videoUrl.match(twitchVideoRegex);
    const twitchClipMatch = videoUrl.match(twitchClipRegex);
    
    if (twitchVideoMatch) {
        const videoId = twitchVideoMatch[1];
        return `<iframe src="https://player.twitch.tv/?video=${videoId}&parent=${window.location.hostname}&parent=localhost" frameborder="0" allowfullscreen="true" scrolling="no" width="100%" height="100%"></iframe>`;
    }
    
    if (twitchClipMatch) {
        const clipId = twitchClipMatch[1];
        return `<iframe src="https://clips.twitch.tv/embed?clip=${clipId}&parent=${window.location.hostname}&parent=localhost" frameborder="0" allowfullscreen="true" scrolling="no" width="100%" height="100%"></iframe>`;
    }
    
    // YouTube
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const youtubeMatch = videoUrl.match(youtubeRegex);
    if (youtubeMatch) {
        const videoId = youtubeMatch[1];
        return `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    }
    
    // Vimeo
    const vimeoRegex = /(?:vimeo\.com\/)(?:.*\/)?(\d+)/;
    const vimeoMatch = videoUrl.match(vimeoRegex);
    if (vimeoMatch) {
        const videoId = vimeoMatch[1];
        return `<iframe src="https://player.vimeo.com/video/${videoId}" width="100%" height="100%" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    }
    
    // Direct video file (mp4, webm, etc.)
    if (videoUrl.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)) {
        return `<video width="100%" height="100%" controls preload="metadata" style="object-fit: contain;"><source src="${videoUrl}" type="video/mp4">Ваш браузер не поддерживает видео.</video>`;
    }
    
    // Fallback: try to embed as iframe
    return `<iframe width="100%" height="100%" src="${videoUrl}" frameborder="0" allowfullscreen></iframe>`;
}

// Show video preview in fullscreen modal on hover
let videoPreviewTimeout = null;

// Setup hover events for candidate items using event delegation
function setupCandidateHoverEvents() {
    // Remove old listeners if any
    const candidatesList = document.querySelectorAll('.candidates-list-hover');
    
    candidatesList.forEach(list => {
        // Use event delegation on the list container
        list.addEventListener('mouseenter', function(e) {
            const label = e.target.closest('.candidate-item-hover');
            if (!label) return;
            
            const videoUrl = label.dataset.videoUrl;
            const candidateName = label.dataset.candidateName;
            const nominationId = parseInt(label.dataset.nominationId);
            const candidateId = parseInt(label.dataset.candidateId);
            
            if (videoUrl && videoUrl.trim() !== '') {
                console.log('Hover detected, showing video:', { nominationId, candidateId, videoUrl, candidateName });
                showVideoPreview(nominationId, candidateId, videoUrl, candidateName);
            }
        }, true);
        
        list.addEventListener('mouseleave', function(e) {
            const label = e.target.closest('.candidate-item-hover');
            if (!label) return;
            
            // Check if we're leaving the entire list area
            if (!list.contains(e.relatedTarget)) {
                hideVideoPreview();
            }
        }, true);
    });
    
    console.log('Candidate hover events setup complete');
}

function showCandidateVideoOnHover(nominationId, candidateId, videoUrl, candidateName) {
    console.log('showCandidateVideoOnHover called:', { nominationId, candidateId, videoUrl, candidateName });
    
    if (!videoUrl || videoUrl.trim() === '' || videoUrl === 'undefined') {
        console.log('No video URL, skipping');
        return;
    }
    
    showVideoPreview(nominationId, candidateId, videoUrl, candidateName);
}

function showVideoPreview(nominationId, candidateId, videoUrl, candidateName) {
    console.log('showVideoPreview called:', { nominationId, candidateId, videoUrl, candidateName });
    
    if (!videoUrl || videoUrl.trim() === '' || videoUrl === 'undefined') {
        console.log('No video URL provided');
        return;
    }
    
    // Clear any existing timeout
    if (videoPreviewTimeout) {
        clearTimeout(videoPreviewTimeout);
    }
    
    // Small delay to prevent flickering
    videoPreviewTimeout = setTimeout(() => {
        const modal = document.getElementById('video-preview-modal');
        const modalContainer = document.getElementById('video-preview-container');
        const modalTitle = document.getElementById('video-preview-title');
        
        if (!modal) {
            console.error('Video preview modal not found');
            return;
        }
        
        if (!modalContainer) {
            console.error('Video preview container not found');
            return;
        }
        
        if (modalTitle) {
            modalTitle.textContent = candidateName;
        }
        
        console.log('Generating embed for URL:', videoUrl);
        const embedCode = getVideoEmbed(videoUrl);
        console.log('Generated embed code length:', embedCode ? embedCode.length : 0);
        
        if (!embedCode || embedCode.trim() === '') {
            console.error('Failed to generate video embed code for:', videoUrl);
            modalContainer.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Не удалось загрузить видео. URL: ${videoUrl}</p>`;
        } else {
            modalContainer.innerHTML = `
                <div class="video-preview-container">
                    ${embedCode}
                </div>
            `;
        }
        
        modal.classList.add('active');
        console.log('Video preview modal activated for:', candidateName);
        console.log('Modal element:', modal);
        console.log('Modal has active class:', modal.classList.contains('active'));
        console.log('Modal display style:', window.getComputedStyle(modal).display);
    }, 300);
}


let hideVideoTimeout = null;

function hideVideoPreview() {
    if (videoPreviewTimeout) {
        clearTimeout(videoPreviewTimeout);
        videoPreviewTimeout = null;
    }
    
    // Clear any existing hide timeout
    if (hideVideoTimeout) {
        clearTimeout(hideVideoTimeout);
    }
    
    // Delay before hiding to allow moving mouse to modal
    hideVideoTimeout = setTimeout(() => {
        const modal = document.getElementById('video-preview-modal');
        const hoveredCandidate = document.querySelector('.candidate-item-hover:hover');
        
        if (modal && !modal.matches(':hover') && !hoveredCandidate) {
            modal.classList.remove('active');
        }
    }, 300);
}

// Keep modal open when hovering over it
document.addEventListener('DOMContentLoaded', function() {
    const videoModal = document.getElementById('video-preview-modal');
    if (videoModal) {
        videoModal.addEventListener('mouseenter', function() {
            if (hideVideoTimeout) {
                clearTimeout(hideVideoTimeout);
                hideVideoTimeout = null;
            }
        });
        
        videoModal.addEventListener('mouseleave', function() {
            hideVideoPreview();
        });
    }
});

function closeVideoPreview() {
    const modal = document.getElementById('video-preview-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Nomination Selection Modal Functions
let currentNominationId = null;
let selectedCandidateId = null;

function openNominationModal(nominationId) {
    currentNominationId = nominationId;
    selectedCandidateId = null;
    
    const modal = document.getElementById('nomination-selection-modal');
    const titleEl = document.getElementById('nomination-modal-title');
    const descriptionEl = document.getElementById('nomination-modal-description');
    const gridEl = document.getElementById('candidates-selection-grid');
    const submitBtn = document.getElementById('submit-vote-btn');
    const hiddenCandidateInput = document.getElementById('selected-candidate-id');
    const hiddenNominationInput = document.getElementById('selected-nomination-id');
    
    if (!modal || !titleEl || !gridEl) {
        console.error('Modal elements not found');
        return;
    }
    
    const nomination = nominations.find(n => n.id === nominationId);
    if (!nomination) {
        console.error('Nomination not found:', nominationId);
        return;
    }
    
    titleEl.textContent = nomination.name;
    if (descriptionEl) {
        descriptionEl.textContent = nomination.description || '';
    }
    
    hiddenNominationInput.value = nominationId;
    
    const nomCandidates = candidates[nominationId] || [];
    
    // Check if user already voted
    const userVote = getUserVoteForNomination(nominationId);
    
    // Check if this nomination should show "No video" message
    const nameLower = nomination.name.toLowerCase();
    const isVideoNomination = nameLower.includes('клип') || 
                               nameLower.includes('видео') ||
                               nameLower.includes('clip') ||
                               nameLower.includes('рейдж');
                               nameLower.includes('хайлайт');
    
    // Check if this nomination is for photos/images (мем года, завоз года)
    const isPhotoNomination = nameLower.includes('мем') || 
                              nameLower.includes('завоз') ||
                              nameLower.includes('meme') ||
                              nameLower.includes('фото');
    
    // Check if upload is allowed for this specific nomination
    // Photo upload: only for "Завоз года"
    const allowsPhotoUpload = nameLower.includes('завоз') && nameLower.includes('год');
    
    // Video upload: only for "Клип года" and "Рейдж года"
    const allowsVideoUpload = (nameLower.includes('клип') || nameLower.includes('рейдж')) && nameLower.includes('год');
    
    gridEl.innerHTML = nomCandidates.map(candidate => {
        const isSelected = userVote && userVote.candidate_id === candidate.id;
        let mediaSection = '';
        
        // Prioritize image_url for photo nominations
        if (isPhotoNomination && candidate.image_url) {
            const imageUrl = normalizeImageUrl(candidate.image_url);
            mediaSection = `
                <div class="candidate-image-preview" onclick="event.stopPropagation(); openImageFullscreen('${imageUrl.replace(/'/g, "\\'")}', '${candidate.name.replace(/'/g, "\\'")}')">
                    <img src="${imageUrl.replace(/"/g, '&quot;')}" alt="${candidate.name.replace(/"/g, '&quot;')}" />
                    <div class="image-zoom-hint">🔍 Кликните для увеличения</div>
                </div>
            `;
        } else if (candidate.video_url) {
            mediaSection = `
                <div class="candidate-video-preview" data-video-url="${candidate.video_url.replace(/"/g, '&quot;')}">
                    ${getVideoEmbed(candidate.video_url)}
                </div>
            `;
        } else if (isVideoNomination) {
            mediaSection = '<div class="candidate-no-video">Нет видео</div>';
        } else if (isPhotoNomination) {
            mediaSection = '<div class="candidate-no-image">Нет фотографии</div>';
        }
        
        return `
            <div class="candidate-selection-card ${isSelected ? 'selected' : ''}" 
                 data-candidate-id="${candidate.id}"
                 onclick="selectCandidate(${candidate.id}, ${nominationId})">
                <div class="candidate-selection-header">
                    <h3 class="candidate-selection-name">${candidate.name}</h3>
                    ${isSelected ? '<span class="selected-badge">Выбран</span>' : ''}
                </div>
                ${mediaSection}
            </div>
        `;
    }).join('');
    
    // Remove any existing upload sections first
    const existingUploadSections = document.querySelectorAll('.nomination-upload-section');
    existingUploadSections.forEach(section => section.remove());
    
    // Add upload button only for specific nominations if user is authenticated
    if (currentUser) {
        let uploadType = null;
        let uploadLabel = null;
        
        if (allowsPhotoUpload) {
            uploadType = 'image';
            uploadLabel = 'Загрузить фото';
        } else if (allowsVideoUpload) {
            uploadType = 'video';
            uploadLabel = 'Загрузить видео';
        }
        
        if (uploadType && uploadLabel) {
            const uploadSection = document.createElement('div');
            uploadSection.className = 'nomination-upload-section';
            uploadSection.innerHTML = `
                <button type="button" class="btn btn-secondary btn-block" onclick="openFileUploadModal('${uploadType}', handleFileUploadCallback)">
                    📤 ${uploadLabel}
                </button>
            `;
            const formEl = document.getElementById('nomination-vote-form');
            if (formEl && formEl.parentNode) {
                formEl.parentNode.insertBefore(uploadSection, formEl);
            }
        }
    }
    
    if (userVote) {
        selectedCandidateId = userVote.candidate_id;
        hiddenCandidateInput.value = userVote.candidate_id;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Изменить голос';
    } else {
        hiddenCandidateInput.value = '';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Проголосовать';
    }
    
    modal.classList.add('active');
}

// Callback for file upload - stores the uploaded URL for use when creating candidate
let uploadedFileUrl = null;

function handleFileUploadCallback(url) {
    uploadedFileUrl = url;
    // Show success message
    showModal('Файл загружен', `Файл успешно загружен: ${url}. Теперь вы можете создать кандидата с этим файлом через API или административную панель.`);
}

function selectCandidate(candidateId, nominationId) {
    selectedCandidateId = candidateId;
    
    const hiddenInput = document.getElementById('selected-candidate-id');
    const submitBtn = document.getElementById('submit-vote-btn');
    const cards = document.querySelectorAll('.candidate-selection-card');
    
    if (hiddenInput) {
        hiddenInput.value = candidateId;
    }
    
    if (submitBtn) {
        submitBtn.disabled = false;
    }
    
    // Update visual selection
    cards.forEach(card => {
        const cardCandidateId = parseInt(card.dataset.candidateId);
        if (cardCandidateId === candidateId) {
            card.classList.add('selected');
            const header = card.querySelector('.candidate-selection-header');
            if (header && !header.querySelector('.selected-badge')) {
                const badge = document.createElement('span');
                badge.className = 'selected-badge';
                badge.textContent = 'Выбран';
                header.appendChild(badge);
            }
        } else {
            card.classList.remove('selected');
            const badge = card.querySelector('.selected-badge');
            if (badge) {
                badge.remove();
            }
        }
    });
}

function closeNominationModal() {
    const modal = document.getElementById('nomination-selection-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    currentNominationId = null;
    selectedCandidateId = null;
}

function handleNominationVoteFromModal(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const nominationId = parseInt(formData.get('nomination_id'));
    const candidateId = parseInt(formData.get('candidate_id'));
    
    if (!nominationId || !candidateId) {
        showModal('Ошибка', 'Пожалуйста, выберите кандидата');
        return;
    }
    
    handleNominationVote(null, nominationId, candidateId);
}

function getUserVoteForNomination(nominationId) {
    // This will be populated when we load user votes
    if (!window.userVotes) return null;
    const vote = window.userVotes.find(v => v.nomination_id === nominationId);
    // Convert to match new structure if needed
    if (vote && vote.candidate_id) {
        return vote;
    }
    return null;
}

async function handleNominationVote(event, nominationId, candidateId = null) {
    if (event) {
        event.preventDefault();
    }
    
    if (!currentUser) {
        showAuthModal();
        return;
    }
    
    // If candidateId is not provided, try to get it from form
    if (!candidateId && event && event.target) {
        const form = event.target;
        const formData = new FormData(form);
        candidateId = formData.get(`candidate_${nominationId}`) || formData.get('candidate_id');
    }
    
    if (!candidateId) {
        showModal('Ошибка', 'Пожалуйста, выберите кандидата.');
        return;
    }
    
    try {
        await apiRequest('/votes', {
            method: 'POST',
            body: JSON.stringify({
                nomination_id: nominationId,
                candidate_id: parseInt(candidateId)
            })
        });
        
        const candidate = candidates[nominationId].find(c => c.id === parseInt(candidateId));
        const nomination = nominations.find(n => n.id === nominationId);
        
        showModal('Голос учтен', 
            `Спасибо! Твой голос за "${candidate.name}" в номинации "${nomination.name}" учтен.`);
        
        // Close nomination modal if open
        closeNominationModal();
        
        // Reload user votes and re-render nominations
        if (currentUser) {
            await loadUserVotes();
        }
        await renderNominations();
        await loadResults();
    } catch (error) {
        showModal('Ошибка', error.message || 'Не удалось отправить голос. Попробуйте снова.');
    }
}

async function loadUserVotes() {
    if (!currentUser) {
        window.userVotes = [];
        return;
    }
    
    try {
        window.userVotes = await apiRequest('/votes/my');
    } catch (error) {
        console.error('Failed to load user votes:', error);
        window.userVotes = [];
    }
}

function updateNominationSelect() {
    const nominationSelect = document.getElementById('nomination-select');
    if (!nominationSelect) return;

    // Clear existing options except the first one
    nominationSelect.innerHTML = '<option value="">Выбери номинацию</option>';
    
    nominations.forEach(nomination => {
        const option = document.createElement('option');
        option.value = nomination.id;
        option.textContent = nomination.name;
        nominationSelect.appendChild(option);
    });
}


// Results
function initResults() {
    const filter = document.getElementById('results-nomination-filter');
    if (filter) {
        filter.addEventListener('change', function() {
            loadResults();
        });
    }
    setResultsAvailability(resultsUnlocked);
}

function setResultsAvailability(isOpen) {
    const container = document.getElementById('results-container');
    const filter = document.getElementById('results-nomination-filter');
    const refreshBtn = document.querySelector('#results .results-controls button');

    if (!container) return;

    if (!isOpen) {
        if (filter) filter.disabled = true;
        if (refreshBtn) refreshBtn.disabled = true;
        container.innerHTML = '<p class="results-locked results-empty">Итоги откроются после завершения таймера.</p>';
        return;
    }

    if (filter) filter.disabled = false;
    if (refreshBtn) refreshBtn.disabled = false;
    loadResults();
}

async function loadResults() {
    if (!resultsUnlocked) {
        setResultsAvailability(false);
        return;
    }
    const container = document.getElementById('results-container');
    const filter = document.getElementById('results-nomination-filter');
    
    if (!container) return;

    container.innerHTML = '<p class="results-loading">Загрузка результатов...</p>';

    try {
        const nominationId = filter ? filter.value : '';
        // API_BASE_URL already includes /api, so keep endpoint relative
        const url = nominationId 
            ? `/votes/results?nomination_id=${nominationId}`
            : '/votes/results';
        
        const results = await apiRequest(url);
        
        // Ensure results is an array
        if (!Array.isArray(results)) {
            console.warn('Results is not an array:', results);
            container.innerHTML = '<p class="results-empty">Ошибка загрузки результатов. Попробуйте обновить страницу.</p>';
            return;
        }
        
        if (results.length === 0) {
            container.innerHTML = '<p class="results-empty">Пока нет результатов голосования. Будь первым, кто проголосует!</p>';
            return;
        }

        // Group results by nomination
        const groupedResults = {};
        results.forEach(result => {
            const key = result.nomination_id;
            if (!groupedResults[key]) {
                groupedResults[key] = {
                    nomination_id: result.nomination_id,
                    nomination_name: result.nomination_name,
                    candidates: []
                };
            }
            groupedResults[key].candidates.push({
                name: result.candidate_name,
                votes: parseInt(result.vote_count)
            });
        });

        // Sort candidates by votes (descending) and find winners
        Object.keys(groupedResults).forEach(key => {
            const group = groupedResults[key];
            group.candidates.sort((a, b) => b.votes - a.votes);
            const maxVotes = group.candidates[0].votes;
            group.maxVotes = maxVotes;
            group.totalVotes = group.candidates.reduce((sum, c) => sum + c.votes, 0);
        });

        // Render results
        container.innerHTML = '';
        Object.values(groupedResults).forEach(group => {
            const nominationDiv = document.createElement('div');
            nominationDiv.className = 'results-nomination';
            
            const title = document.createElement('h3');
            title.className = 'results-nomination-title';
            title.textContent = group.nomination_name;
            nominationDiv.appendChild(title);

            const list = document.createElement('ul');
            list.className = 'results-list';
            
            group.candidates.forEach((candidate, index) => {
                const isWinner = candidate.votes === group.maxVotes && candidate.votes > 0;
                const percentage = group.totalVotes > 0 
                    ? Math.round((candidate.votes / group.totalVotes) * 100) 
                    : 0;
                
                const item = document.createElement('li');
                item.className = `results-item ${isWinner ? 'winner' : ''}`;
                
                const candidateName = document.createElement('div');
                candidateName.className = `results-candidate ${isWinner ? 'winner' : ''}`;
                candidateName.textContent = candidate.name;
                
                const votesDiv = document.createElement('div');
                votesDiv.className = 'results-votes';
                
                const voteCount = document.createElement('div');
                voteCount.className = 'results-vote-count';
                voteCount.textContent = candidate.votes;
                
                const barContainer = document.createElement('div');
                barContainer.className = 'results-bar';
                const barFill = document.createElement('div');
                barFill.className = 'results-bar-fill';
                barFill.style.width = `${percentage}%`;
                barContainer.appendChild(barFill);
                
                votesDiv.appendChild(voteCount);
                votesDiv.appendChild(barContainer);
                
                item.appendChild(candidateName);
                item.appendChild(votesDiv);
                list.appendChild(item);
            });
            
            nominationDiv.appendChild(list);
            container.appendChild(nominationDiv);
        });

        // Update filter options if needed
        if (filter && nominations.length > 0) {
            const currentValue = filter.value;
            filter.innerHTML = '<option value="">Все номинации</option>';
            nominations.forEach(nom => {
                const option = document.createElement('option');
                option.value = nom.id;
                option.textContent = nom.name;
                if (nom.id == currentValue) {
                    option.selected = true;
                }
                filter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load results:', error);
        container.innerHTML = `<p class="results-empty">Ошибка загрузки результатов: ${error.message}</p>`;
    }
}

// FAQ
function toggleFaq(button) {
    const faqItem = button.closest('.faq-item');
    const isActive = faqItem.classList.contains('active');

    // Close all FAQ items
    document.querySelectorAll('.faq-item').forEach(item => {
        item.classList.remove('active');
    });

    // Open clicked item if it wasn't active
    if (!isActive) {
        faqItem.classList.add('active');
    }
}

// Modal
function showModal(title, message) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    
    if (modal && modalBody) {
        modalBody.innerHTML = `
            <h2>${title}</h2>
            <p>${message}</p>
            <button class="btn btn-primary" onclick="closeModal()">Закрыть</button>
        `;
        modal.classList.add('active');
    }
}

function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Close modal on outside click
document.addEventListener('click', function(e) {
    const modal = document.getElementById('modal');
    if (e.target === modal) {
        closeModal();
    }
});

// Image Fullscreen Functions
function openImageFullscreen(imageUrl, imageAlt) {
    const modal = document.getElementById('image-fullscreen-modal');
    const img = document.getElementById('image-fullscreen-img');
    
    if (!modal || !img) {
        console.error('Image fullscreen modal elements not found');
        return;
    }
    
    img.src = imageUrl;
    img.alt = imageAlt || '';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeImageFullscreen() {
    const modal = document.getElementById('image-fullscreen-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }
}

// Close modal on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal();
        closeAuthModal();
        closeVideoPreview();
        closeImageFullscreen();
    }
});

// Close image fullscreen modal on outside click
document.addEventListener('click', function(e) {
    const imageModal = document.getElementById('image-fullscreen-modal');
    if (imageModal && e.target === imageModal) {
        closeImageFullscreen();
    }
});

// File Upload Functions
let currentUploadType = null; // 'image' or 'video'
let selectedFile = null;
let uploadCallback = null; // Callback function to call after successful upload
let currentNominationIdForUpload = null; // Store nomination ID for candidate creation

function openFileUploadModal(type, callback) {
    currentUploadType = type;
    uploadCallback = callback;
    selectedFile = null;
    currentNominationIdForUpload = currentNominationId; // Store current nomination ID
    
    const modal = document.getElementById('file-upload-modal');
    const titleEl = document.getElementById('file-upload-title');
    const hintEl = document.getElementById('file-upload-hint');
    const fileInput = document.getElementById('file-input');
    const dropzone = document.getElementById('file-dropzone');
    
    if (!modal) {
        console.error('File upload modal not found');
        return;
    }
    
    // Set title and hint based on type
    if (type === 'image') {
        titleEl.textContent = 'Загрузка изображения';
        hintEl.textContent = 'Поддерживаемые форматы: JPEG, JPG, PNG, GIF, WEBP (макс. 10 МБ)';
        fileInput.accept = 'image/jpeg,image/jpg,image/png,image/gif,image/webp';
    } else if (type === 'video') {
        titleEl.textContent = 'Загрузка видео';
        hintEl.textContent = 'Поддерживаемые форматы: MP4, WEBM, OGG, MOV, AVI (макс. 100 МБ)';
        fileInput.accept = 'video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo';
    }
    
    // Reset UI
    document.getElementById('file-upload-preview').style.display = 'none';
    document.getElementById('file-upload-progress').style.display = 'none';
    document.getElementById('file-upload-error').style.display = 'none';
    document.getElementById('upload-submit-btn').disabled = true;
    dropzone.classList.remove('dragover');
    
    modal.classList.add('active');
}

function closeFileUploadModal() {
    const modal = document.getElementById('file-upload-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    selectedFile = null;
    currentUploadType = null;
    uploadCallback = null;
    currentNominationIdForUpload = null;
}

function clearFileSelection() {
    selectedFile = null;
    const fileInput = document.getElementById('file-input');
    fileInput.value = '';
    document.getElementById('file-upload-preview').style.display = 'none';
    document.getElementById('file-upload-candidate-name').style.display = 'none';
    document.getElementById('candidate-name-input').value = '';
    document.getElementById('upload-submit-btn').disabled = true;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Initialize file upload UI
document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('file-input');
    const dropzone = document.getElementById('file-dropzone');
    const previewEl = document.getElementById('file-upload-preview');
    const previewName = document.getElementById('file-preview-name');
    const previewSize = document.getElementById('file-preview-size');
    
    if (!fileInput || !dropzone) return;
    
    // Click on dropzone to open file picker
    dropzone.addEventListener('click', function(e) {
        if (e.target.closest('.file-upload-link')) {
            fileInput.click();
        }
    });
    
    // File input change
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            handleFileSelection(file);
        }
    });
    
    // Drag and drop
    dropzone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    
    dropzone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        dropzone.classList.remove('dragover');
    });
    
    dropzone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        
        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileSelection(file);
        }
    });
    
    function handleFileSelection(file) {
        // Validate file type
        const isValidType = currentUploadType === 'image' 
            ? file.type.startsWith('image/')
            : file.type.startsWith('video/');
        
        if (!isValidType) {
            showFileUploadError(`Неверный тип файла. Ожидается ${currentUploadType === 'image' ? 'изображение' : 'видео'}.`);
            return;
        }
        
        // Validate file size
        const maxSize = currentUploadType === 'image' ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
        if (file.size > maxSize) {
            showFileUploadError(`Файл слишком большой. Максимальный размер: ${formatFileSize(maxSize)}`);
            return;
        }
        
        selectedFile = file;
        previewName.textContent = file.name;
        previewSize.textContent = formatFileSize(file.size);
        previewEl.style.display = 'block';
        // Show candidate name input
        document.getElementById('file-upload-candidate-name').style.display = 'block';
        document.getElementById('upload-submit-btn').disabled = false;
        document.getElementById('file-upload-error').style.display = 'none';
    }
});

function showFileUploadError(message) {
    const errorEl = document.getElementById('file-upload-error');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

async function uploadFile() {
    if (!selectedFile || !currentUploadType) {
        showFileUploadError('Файл не выбран');
        return;
    }
    
    // Check candidate name
    const candidateNameInput = document.getElementById('candidate-name-input');
    const candidateName = candidateNameInput.value.trim();
    
    if (!candidateName) {
        showFileUploadError('Пожалуйста, введите название кандидата');
        candidateNameInput.focus();
        return;
    }
    
    if (!currentNominationIdForUpload) {
        showFileUploadError('Ошибка: номинация не определена');
        return;
    }
    
    const formData = new FormData();
    const fieldName = currentUploadType === 'image' ? 'image' : 'video';
    formData.append(fieldName, selectedFile);
    
    const progressEl = document.getElementById('file-upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const submitBtn = document.getElementById('upload-submit-btn');
    const errorEl = document.getElementById('file-upload-error');
    
    // Show progress
    progressEl.style.display = 'block';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Загрузка...';
    errorEl.style.display = 'none';
    progressFill.style.width = '0%';
    
    try {
        const token = localStorage.getItem('token');
        const endpoint = `/upload/${currentUploadType}`;
        
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', function(e) {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                progressFill.style.width = percentComplete + '%';
            }
        });
        
        xhr.addEventListener('load', async function() {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                progressFill.style.width = '100%';
                submitBtn.textContent = 'Создание кандидата...';
                
                // Get candidate name
                const candidateNameInput = document.getElementById('candidate-name-input');
                const candidateName = candidateNameInput.value.trim();
                
                if (!candidateName) {
                    showFileUploadError('Пожалуйста, введите название кандидата');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Загрузить';
                    progressEl.style.display = 'none';
                    return;
                }
                
                if (!currentNominationIdForUpload) {
                    showFileUploadError('Ошибка: номинация не определена');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Загрузить';
                    progressEl.style.display = 'none';
                    return;
                }
                
                // Create candidate with uploaded file
                try {
                    const candidateData = {
                        nomination_id: currentNominationIdForUpload,
                        name: candidateName
                    };
                    
                    if (currentUploadType === 'image') {
                        candidateData.image_url = response.url;
                    } else {
                        candidateData.video_url = response.url;
                    }
                    
                    const candidateResponse = await apiRequest('/candidates', {
                        method: 'POST',
                        body: JSON.stringify(candidateData)
                    });
                    
                    // Save nomination ID and check if nomination modal is open BEFORE closing upload modal
                    const nominationIdToRefresh = currentNominationIdForUpload;
                    const nominationModal = document.getElementById('nomination-selection-modal');
                    const wasNominationModalOpen = nominationModal && nominationModal.classList.contains('active');
                    
                    // Reload candidates for the nomination
                    await loadCandidatesForNominations();
                    
                    // Call callback if provided
                    if (uploadCallback && typeof uploadCallback === 'function') {
                        uploadCallback(response.url);
                    }
                    
                    // Close upload modal
                    const uploadModal = document.getElementById('file-upload-modal');
                    if (uploadModal) {
                        uploadModal.classList.remove('active');
                    }
                    selectedFile = null;
                    currentUploadType = null;
                    uploadCallback = null;
                    
                    // Small delay to ensure upload modal closes before refreshing nomination modal
                    setTimeout(async () => {
                        // Refresh the nomination modal if it was open
                        if (nominationIdToRefresh && wasNominationModalOpen) {
                            // Refresh the modal with updated candidates
                            openNominationModal(nominationIdToRefresh);
                        }
                        
                        // Update main nominations grid
                        await renderNominations();
                        
                        // Reset upload variable
                        currentNominationIdForUpload = null;
                        
                        // Show success message
                        showModal('Успешно', `Кандидат "${candidateName}" успешно создан с загруженным файлом!`);
                    }, 200);
                } catch (candidateError) {
                    console.error('Create candidate error:', candidateError);
                    showFileUploadError(candidateError.message || 'Файл загружен, но не удалось создать кандидата');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Загрузить';
                    progressEl.style.display = 'none';
                }
            } else {
                const error = JSON.parse(xhr.responseText);
                showFileUploadError(error.error || 'Ошибка загрузки файла');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Загрузить';
                progressEl.style.display = 'none';
            }
        });
        
        xhr.addEventListener('error', function() {
            showFileUploadError('Ошибка соединения с сервером');
            submitBtn.disabled = false;
            progressEl.style.display = 'none';
        });
        
        xhr.open('POST', `${API_BASE_URL}${endpoint}`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
        
    } catch (error) {
        console.error('Upload error:', error);
        showFileUploadError(error.message || 'Ошибка загрузки файла');
        submitBtn.disabled = false;
        progressEl.style.display = 'none';
    }
}

// Close file upload modal on outside click
document.addEventListener('click', function(e) {
    const fileModal = document.getElementById('file-upload-modal');
    if (fileModal && e.target === fileModal) {
        closeFileUploadModal();
    }
});

// Smooth scroll on page load
window.addEventListener('load', function() {
    if (window.location.hash) {
        const hash = window.location.hash.substring(1);
        setTimeout(() => {
            scrollToSection(hash);
        }, 100);
    }
});

// Add scroll effect to header
let lastScroll = 0;
window.addEventListener('scroll', function() {
    const header = document.querySelector('.header');
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
        header.style.background = 'rgba(10, 10, 10, 0.98)';
    } else {
        header.style.background = 'rgba(10, 10, 10, 0.95)';
    }

    lastScroll = currentScroll;
});

// ========== ADMIN PANEL FUNCTIONS ==========

let currentAdminTab = 'nominations';

async function showAdminPanel() {
    const modal = document.getElementById('admin-panel-modal');
    if (!modal) return;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    await loadAdminNominations();
    await loadAdminCandidates();
}

function closeAdminPanel() {
    const modal = document.getElementById('admin-panel-modal');
    if (!modal) return;
    
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function switchAdminTab(tab) {
    currentAdminTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.admin-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`admin-${tab}-tab`).classList.add('active');
    
    // Load data if needed
    if (tab === 'nominations') {
        loadAdminNominations();
    } else if (tab === 'candidates') {
        loadAdminCandidates();
    }
}

async function loadAdminNominations() {
    try {
        // Get all nominations (including inactive) - API returns only active by default
        // We'll fetch each nomination individually to get all data
        const activeNominations = await apiRequest('/nominations');
        
        // Try to get all nominations with admin access
        let allNominations = activeNominations;
        try {
            // Fetch nominations one by one to get inactive ones
            const maxId = Math.max(...activeNominations.map(n => n.id), 0);
            const fetchedNominations = [];
            
            for (let i = 1; i <= maxId + 5; i++) {
                try {
                    const nom = await apiRequest(`/nominations/${i}`);
                    if (nom) fetchedNominations.push(nom);
                } catch (e) {
                    // Skip if not found
                }
            }
            
            if (fetchedNominations.length > 0) {
                allNominations = fetchedNominations;
            }
        } catch (e) {
            // Fallback to active nominations only
        }
        
        const listEl = document.getElementById('admin-nominations-list');
        if (!listEl) return;
        
        if (!allNominations || allNominations.length === 0) {
            listEl.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Номинаций пока нет</p>';
            return;
        }
        
        listEl.innerHTML = allNominations.map(nom => `
            <div class="admin-item" data-id="${nom.id}">
                <div class="admin-item-content">
                    <div>
                        <h4>${nom.name} ${nom.is_active === 0 ? '<span style="color: #ff6b6b;">(неактивна)</span>' : ''}</h4>
                        ${nom.description ? `<p style="color: var(--text-secondary); margin-top: 0.5rem;">${nom.description}</p>` : ''}
                    </div>
                    <div class="admin-item-actions">
                        <button class="btn btn-small btn-primary" onclick="editNomination(${nom.id})">Редактировать</button>
                        <button class="btn btn-small btn-secondary" onclick="deleteNomination(${nom.id})">${nom.is_active === 0 ? 'Активировать' : 'Деактивировать'}</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load nominations error:', error);
        showModal('Ошибка', 'Не удалось загрузить номинации');
    }
}

async function loadAdminCandidates() {
    try {
        const filterId = document.getElementById('admin-nomination-filter')?.value || '';
        
        // Load nominations for filter
        const nominations = await apiRequest('/nominations');
        const filterSelect = document.getElementById('admin-nomination-filter');
        if (filterSelect && filterSelect.children.length === 1) {
            nominations.forEach(nom => {
                const option = document.createElement('option');
                option.value = nom.id;
                option.textContent = nom.name;
                filterSelect.appendChild(option);
            });
            if (filterId) filterSelect.value = filterId;
        }
        
        let candidates;
        if (filterId) {
            candidates = await apiRequest(`/candidates?nomination_id=${filterId}`);
        } else {
            // Get all candidates
            const allCandidates = [];
            for (const nom of nominations) {
                const nomCandidates = await apiRequest(`/candidates?nomination_id=${nom.id}`);
                allCandidates.push(...nomCandidates.map(c => ({...c, nomination_name: nom.name})));
            }
            candidates = allCandidates;
        }
        
        const listEl = document.getElementById('admin-candidates-list');
        if (!listEl) return;
        
        if (!candidates || candidates.length === 0) {
            listEl.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Кандидатов нет</p>';
            return;
        }
        
        listEl.innerHTML = candidates.map(cand => `
            <div class="admin-item" data-id="${cand.id}">
                <div class="admin-item-content">
                    <div>
                        <h4>${cand.name}</h4>
                        <p style="color: var(--text-secondary); margin-top: 0.5rem;">
                            Номинация: ${cand.nomination_name || 'Неизвестно'}<br>
                            ${cand.image_url ? `📷 Фото: ${cand.image_url}` : ''}
                            ${cand.video_url ? `🎬 Видео: ${cand.video_url}` : ''}
                        </p>
                    </div>
                    <div class="admin-item-actions">
                        <button class="btn btn-small btn-primary" onclick="editCandidate(${cand.id})">Редактировать</button>
                        <button class="btn btn-small btn-secondary" onclick="deleteCandidate(${cand.id})">Удалить</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load candidates error:', error);
        showModal('Ошибка', 'Не удалось загрузить кандидатов');
    }
}

function showAddNominationForm() {
    const name = prompt('Введите название номинации:');
    if (!name || !name.trim()) return;
    
    const description = prompt('Введите описание (можно оставить пустым):') || '';
    
    addNomination(name.trim(), description.trim());
}

async function addNomination(name, description) {
    try {
        await apiRequest('/nominations', {
            method: 'POST',
            body: JSON.stringify({ name, description })
        });
        
        showModal('Успешно', 'Номинация добавлена!');
        await loadAdminNominations();
        await renderNominations(); // Refresh main page
    } catch (error) {
        showModal('Ошибка', error.message || 'Не удалось добавить номинацию');
    }
}


async function showAddCandidateForm() {
    try {
        const nominations = await apiRequest('/nominations');

        if (!nominations || nominations.length === 0) {
            showModal('Ошибка', 'Нет доступных номинаций для добавления кандидата.');
            return;
        }

        // Сформируем список номинаций для выбора
        const nomListText = nominations.map(n => `${n.id}: ${n.name}`).join('\n');
        const nomPrompt = `Выберите номинацию (введите ID) из списка:\n\n${nomListText}`;
        const nomIdRaw = prompt(nomPrompt, nominations[0].id);
        if (nomIdRaw === null) return;
        const nominationId = parseInt(nomIdRaw, 10);
        if (Number.isNaN(nominationId) || !nominations.find(n => n.id === nominationId)) {
            alert('Неверный ID номинации.');
            return;
        }

        const name = prompt('Имя/название кандидата:');
        if (name === null) return;
        const trimmedName = name.trim();
        if (!trimmedName) {
            alert('Имя кандидата не может быть пустым.');
            return;
        }

        // Получим саму номинацию для определения, нужно ли запрашивать фото/видео
        const nomination = nominations.find(n => n.id === nominationId);

        let image_url = null;
        let video_url = null;

        // Для номинаций, содержащих в названии подсказки про фото/видео — попросим ссылки
        const nomLower = (nomination.name || '').toLowerCase();
        if (nomLower.includes('фото') || nomLower.includes('завоз') || nomLower.includes('портрет') || nomLower.includes('фото:')) {
            const img = prompt('URL фото (оставьте пустым если не нужно):', '');
            if (img !== null) image_url = img.trim() || null;
        } else {
            // даём возможность добавить фото в любом случае
            const addImg = confirm('Добавить фото для кандидата?');
            if (addImg) {
                const img = prompt('URL фото (оставьте пустым чтобы пропустить):', '');
                if (img !== null) image_url = img.trim() || null;
            }
        }

        if (nomLower.includes('видео') || nomLower.includes('клип') || nomLower.includes('видео:') || nomLower.includes('рейдж')) {
            const vid = prompt('URL видео (оставьте пустым если не нужно):', '');
            if (vid !== null) video_url = vid.trim() || null;
        } else {
            const addVid = confirm('Добавить ссылку на видео (если есть)?');
            if (addVid) {
                const vid = prompt('URL видео (оставьте пустым чтобы пропустить):', '');
                if (vid !== null) video_url = vid.trim() || null;
            }
        }

        // Собираем payload и отправляем
        const payload = {
            name: trimmedName,
            nomination_id: nominationId
        };
        if (image_url !== null) payload.image_url = image_url;
        if (video_url !== null) payload.video_url = video_url;

        await addCandidate(payload);
    } catch (err) {
        console.error('showAddCandidateForm error:', err);
        showModal('Ошибка', 'Не удалось открыть форму добавления кандидата.');
    }
}

/**
 * Добавить кандидата через API
 * @param {{name: string, nomination_id: number, image_url?: string|null, video_url?: string|null}} data
 */
async function addCandidate(data) {
    try {
        await apiRequest('/candidates', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        showModal('Успешно', 'Кандидат добавлен!');
        await loadAdminCandidates();
        await renderNominations(); // если на главной странице есть зависимости
    } catch (error) {
        console.error('addCandidate error:', error);
        showModal('Ошибка', error.message || 'Не удалось добавить кандидата');
    }
}

// Вставка/подключение кнопки "Добавить кандидата" в loadAdminCandidates (если кнопки нет)
const originalLoadAdminCandidates = loadAdminCandidates;
loadAdminCandidates = async function() {
    // перед основным выполнением попробуем добавить кнопку если её нет
    try {
        const listEl = document.getElementById('admin-candidates-list');
        if (listEl) {
            // ищем существующую кнопку по id
            if (!document.getElementById('admin-add-candidate-btn')) {
                // создаём контейнер под заголовок в списке
                const header = document.createElement('div');
                header.className = 'admin-candidates-header';
                header.style.display = 'flex';
                header.style.justifyContent = 'flex-end';
                header.style.marginBottom = '0.5rem';

                const btn = document.createElement('button');
                btn.id = 'admin-add-candidate-btn';
                btn.className = 'btn btn-small btn-primary';
                btn.textContent = 'Добавить кандидата';
                btn.onclick = showAddCandidateForm;

                header.appendChild(btn);
                listEl.parentNode && listEl.parentNode.insertBefore(header, listEl);
            } else {
                // если кнопка есть — гарантируем что её onclick установлен
                document.getElementById('admin-add-candidate-btn').onclick = showAddCandidateForm;
            }
        }
    } catch (e) {
        // не критично — продолжим
        console.warn('Не получилось добавить кнопку "Добавить кандидата":', e);
    }

    // Вызов оригинальной логики загрузки кандидатов
    return originalLoadAdminCandidates.apply(this, arguments);
};

async function editNomination(id) {
    try {
        const nomination = await apiRequest(`/nominations/${id}`);
        
        const newName = prompt('Название:', nomination.name);
        if (newName === null) return;
        
        const newDesc = prompt('Описание:', nomination.description || '');
        if (newDesc === null) return;
        
        const isActive = nomination.is_active !== 0;
        const newActive = confirm(`Номинация ${isActive ? 'активна' : 'неактивна'}. Изменить статус?`);
        
        await apiRequest(`/nominations/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: newName.trim(),
                description: newDesc.trim(),
                is_active: newActive ? !isActive : isActive
            })
        });
        
        showModal('Успешно', 'Номинация обновлена!');
        await loadAdminNominations();
        await renderNominations();
    } catch (error) {
        showModal('Ошибка', error.message || 'Не удалось обновить номинацию');
    }
}

async function deleteNomination(id) {
    try {
        const nomination = await apiRequest(`/nominations/${id}`);
        const confirmText = nomination.is_active === 0 
            ? 'Активировать номинацию?' 
            : 'Деактивировать номинацию? Кандидаты и голоса сохранятся.';
        
        if (!confirm(confirmText)) return;
        
        await apiRequest(`/nominations/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ is_active: nomination.is_active === 0 ? 1 : 0 })
        });
        
        showModal('Успешно', 'Статус номинации изменен!');
        await loadAdminNominations();
        await renderNominations();
    } catch (error) {
        showModal('Ошибка', error.message || 'Не удалось изменить статус номинации');
    }
}

async function editCandidate(id) {
    try {
        const candidate = await apiRequest(`/candidates/${id}`);
        const nominations = await apiRequest('/nominations');
        // Try to get nomination even if inactive
        let nomination = nominations.find(n => n.id === candidate.nomination_id);
        if (!nomination) {
            try {
                nomination = await apiRequest(`/nominations/${candidate.nomination_id}`);
            } catch (e) {
                // Nomination not found
            }
        }
        
        const newName = prompt('Название кандидата:', candidate.name);
        if (newName === null || !newName.trim()) return;
        
        const updateData = { name: newName.trim() };
        
        // Handle image URL if nomination supports images
        if (nomination?.name?.toLowerCase().includes('завоз')) {
            const changeImage = confirm(`Текущее фото: ${candidate.image_url || 'нет'}\n\nИзменить фото?`);
            if (changeImage) {
                const newImageUrl = prompt('URL фото (оставьте пустым чтобы удалить):', candidate.image_url || '');
                if (newImageUrl !== null) {
                    updateData.image_url = newImageUrl.trim() || null;
                }
            }
        }
        
        // Handle video URL if nomination supports videos
        if (nomination?.name?.toLowerCase().includes('клип') || nomination?.name?.toLowerCase().includes('рейдж')) {
            const changeVideo = confirm(`Текущее видео: ${candidate.video_url || 'нет'}\n\nИзменить видео?`);
            if (changeVideo) {
                const newVideoUrl = prompt('URL видео (оставьте пустым чтобы удалить):', candidate.video_url || '');
                if (newVideoUrl !== null) {
                    updateData.video_url = newVideoUrl.trim() || null;
                }
            }
        }
        
        await apiRequest(`/candidates/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
        
        showModal('Успешно', 'Кандидат обновлен!');
        await loadAdminCandidates();
        await renderNominations();
    } catch (error) {
        showModal('Ошибка', error.message || 'Не удалось обновить кандидата');
    }
}

async function deleteCandidate(id) {
    if (!confirm('Удалить кандидата? Это действие нельзя отменить. Голоса за этого кандидата будут удалены.')) {
        return;
    }
    
    try {
        await apiRequest(`/candidates/${id}`, {
            method: 'DELETE'
        });
        
        showModal('Успешно', 'Кандидат удален!');
        await loadAdminCandidates();
        await renderNominations();
    } catch (error) {
        showModal('Ошибка', error.message || 'Не удалось удалить кандидата');
    }
}

// Close admin panel on Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const adminModal = document.getElementById('admin-panel-modal');
        if (adminModal && adminModal.classList.contains('active')) {
            closeAdminPanel();
        }
    }
});

