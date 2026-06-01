document.addEventListener('DOMContentLoaded', () => {
  const tokenMatch = window.location.pathname.match(/\/client-view\/([^/]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;

  const API_BASE = '/api/v1/client-view';
  let shortlistData = null;
  let currentCreatorId = null; // applicationId actually
  let currentCreatorProfile = null;

  const els = {
    loader: document.getElementById('loader'),
    mainView: document.getElementById('main-view'),
    errorView: document.getElementById('error-view'),
    successView: document.getElementById('success-view'),
    errorTitle: document.getElementById('error-title'),
    errorMessage: document.getElementById('error-message'),
    projectTitle: document.getElementById('project-title'),
    projectMeta: document.getElementById('project-meta'),
    creatorsGrid: document.getElementById('creators-grid'),
    
    profileModal: document.getElementById('profile-modal'),
    modalBackdrop: document.getElementById('modal-backdrop'),
    modalClose: document.getElementById('modal-close'),
    modalBody: document.getElementById('modal-body'),
    
    commentModal: document.getElementById('comment-modal'),
    commentModalBackdrop: document.getElementById('comment-modal-backdrop'),
    commentModalClose: document.getElementById('comment-modal-close'),
    commentText: document.getElementById('comment-text'),
    btnCancelComment: document.getElementById('btn-cancel-comment'),
    btnSubmitComment: document.getElementById('btn-submit-comment'),
    btnOpenComment: document.getElementById('btn-open-comment'),
    
    btnBackHome: document.getElementById('btn-back-home'),
    toast: document.getElementById('toast')
  };

  if (!token) {
    showError('Invalid Link', 'No valid token found in the URL.');
    return;
  }

  fetchShortlist();

  function showView(viewEl) {
    [els.loader, els.mainView, els.errorView, els.successView].forEach(el => el.classList.add('hidden'));
    viewEl.classList.remove('hidden');
  }

  function showError(title, message) {
    els.errorTitle.textContent = title;
    els.errorMessage.textContent = message;
    showView(els.errorView);
  }

  function showToast(message, type = 'success') {
    els.toast.textContent = message;
    els.toast.className = `toast ${type}`;
    els.toast.style.transform = 'translate(-50%, 0)';
    setTimeout(() => {
      els.toast.style.opacity = '0';
      els.toast.style.transform = 'translate(-50%, 20px)';
      setTimeout(() => {
        els.toast.classList.add('hidden');
        els.toast.style.opacity = '1';
      }, 300);
    }, 3000);
  }

  async function fetchShortlist() {
    try {
      const response = await fetch(`${API_BASE}/${token}`);
      const data = await response.json();

      if (!response.ok) {
        throw data;
      }

      shortlistData = data;
      renderMainView();
    } catch (err) {
      if (err.status === 'expired') {
        showError('Link Expired', 'This shortlist link has expired.');
      } else if (err.status === 'deactivated') {
        showError('Link Deactivated', 'This link is no longer active.');
      } else {
        showError('Not Found', err.message || 'Unable to load shortlist.');
      }
    }
  }

  function renderMainView() {
    els.projectTitle.textContent = shortlistData.project.title;
    els.projectMeta.textContent = `${shortlistData.project.platform} • ${shortlistData.project.contentType}`;

    els.creatorsGrid.innerHTML = '';
    shortlistData.creators.forEach(creator => {
      const p = creator.profile;
      
      const card = document.createElement('div');
      card.className = 'creator-card';
      card.innerHTML = `
        <img src="${p.photoUrl || '/assets/placeholder-user.png'}" alt="${p.publicName}" class="creator-photo" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100%\\' height=\\'100%\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%231E1E2A\\'/></svg>'">
        <div class="creator-info">
          <h3 class="creator-name">${p.publicName || 'Unknown'}</h3>
          <p class="creator-location">${p.city || ''}${p.city && p.country ? ', ' : ''}${p.country || ''}</p>
          <div class="creator-tags">
            ${(p.categories || []).slice(0, 2).map(c => `<span class="pill">${c}</span>`).join('')}
          </div>
        </div>
      `;
      card.addEventListener('click', () => openProfileModal(creator));
      els.creatorsGrid.appendChild(card);
    });

    showView(els.mainView);
  }

  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num;
  }

  function openProfileModal(creator) {
    currentCreatorId = creator.applicationId;
    currentCreatorProfile = creator;
    const p = creator.profile;

    let mediaHtml = '';
    if (p.media && p.media.length > 0) {
      mediaHtml = `
        <h4 class="section-title mt-4">Recent Work</h4>
        <div class="media-grid">
          ${p.media.slice(0, 6).map(m => `
            <img src="${m.url}" alt="Media" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100%\\' height=\\'100%\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%232A2A38\\'/></svg>'">
          `).join('')}
        </div>
      `;
    }

    els.modalBody.innerHTML = `
      <div class="profile-hero">
        <img src="${p.photoUrl || ''}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100%\\' height=\\'100%\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%231E1E2A\\'/></svg>'">
        <div class="profile-hero-overlay"></div>
      </div>
      <h2>${p.publicName}</h2>
      <p style="color: var(--text-secondary); margin-bottom: 16px;">${p.bio || ''}</p>
      
      <div class="profile-stats-grid">
        ${p.instagramUsername ? `
          <div class="stat-box">
            <div class="stat-value">${formatNumber(p.instagramFollowers || 0)}</div>
            <div class="stat-label">Instagram Followers</div>
          </div>
        ` : ''}
        ${p.tiktokUsername ? `
          <div class="stat-box">
            <div class="stat-value">${formatNumber(p.tiktokFollowers || 0)}</div>
            <div class="stat-label">TikTok Followers</div>
          </div>
        ` : ''}
      </div>

      <div class="mb-4">
        <h4 class="section-title">Application Details</h4>
        <p style="font-size: 14px; background: var(--surface-elevated); padding: 12px; border-radius: 8px;">
          ${creator.message || 'No message provided.'}
        </p>
      </div>

      ${mediaHtml}
    `;

    els.profileModal.classList.remove('hidden');
  }

  function closeProfileModal() {
    els.profileModal.classList.add('hidden');
    currentCreatorId = null;
    currentCreatorProfile = null;
  }

  function openCommentModal() {
    els.commentText.value = '';
    els.commentModal.classList.remove('hidden');
  }

  function closeCommentModal() {
    els.commentModal.classList.add('hidden');
  }

  async function submitDecision(decision, comment = '') {
    if (!currentCreatorId) return;

    try {
      const response = await fetch(`${API_BASE}/${token}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          applicationId: currentCreatorId,
          decision: decision,
          comment: comment
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Error submitting decision');

      showToast(decision === 'COMMENT_ONLY' ? 'Comment saved' : 'Decision submitted successfully');
      
      closeCommentModal();
      closeProfileModal();
      
      if (decision !== 'COMMENT_ONLY') {
        // Optionally, remove the creator from the grid or mark them as decided.
        // For now, we'll just show the success view.
        // If we want them to do multiple, we keep them on mainView and just mark the card.
        // Following T-51: "thank-you state after decision submitted" -> 
        // Wait, if they have multiple creators to decide on, they might want to stay. 
        // Let's mark the card as decided.
        const cards = els.creatorsGrid.querySelectorAll('.creator-card');
        const index = shortlistData.creators.findIndex(c => c.applicationId === currentCreatorId);
        if (index !== -1 && cards[index]) {
          cards[index].style.opacity = '0.5';
          cards[index].style.pointerEvents = 'none';
          
          // Check if all are done
          const allDone = Array.from(cards).every(c => c.style.pointerEvents === 'none');
          if (allDone) {
            showView(els.successView);
          }
        }
      }
    } catch (err) {
      alert(err.message);
    }
  }

  // Event Listeners
  els.modalClose.addEventListener('click', closeProfileModal);
  els.modalBackdrop.addEventListener('click', closeProfileModal);
  
  els.commentModalClose.addEventListener('click', closeCommentModal);
  els.commentModalBackdrop.addEventListener('click', closeCommentModal);
  els.btnCancelComment.addEventListener('click', closeCommentModal);
  
  els.btnOpenComment.addEventListener('click', openCommentModal);

  document.querySelectorAll('.decision-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const decision = e.currentTarget.getAttribute('data-decision');
      if (decision) {
        submitDecision(decision);
      }
    });
  });

  els.btnSubmitComment.addEventListener('click', () => {
    const text = els.commentText.value.trim();
    if (!text) return alert('Please enter a comment.');
    submitDecision('COMMENT_ONLY', text);
  });

  els.btnBackHome.addEventListener('click', () => {
    showView(els.mainView);
  });
});
