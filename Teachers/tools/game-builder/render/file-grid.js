// File grid rendering - Game cards for load modal
import { escapeHtml } from '../utils/dom-helpers.js';

/**
 * Ensure Material Icons font is loaded
 */
export function ensureMaterialIcons() {
  if (document.getElementById('materialIconsLink')) return;
  const link = document.createElement('link');
  link.id = 'materialIconsLink';
  link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
  link.rel = 'stylesheet';
  document.head.appendChild(link);
}

/**
 * Build HTML for a single game card
 * @param {Object} game - Game data
 * @param {boolean} owned - Whether user owns this game
 * @param {boolean} isSelected - Whether card is selected
 * @param {string} currentUid - Current user ID
 * @returns {string} HTML string
 */
export function buildGameCardHTML(game, owned, isSelected, currentUid) {
  const when = game.created_at ? new Date(game.created_at).toLocaleDateString() : '';
  const imageUrl = game.thumb_url || game.game_image || game.first_image_url || '';
  const placeholderSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180"><rect width="300" height="180" fill="#f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="#94a3b8">Loading...</text></svg>';
  const placeholder = 'data:image/svg+xml;utf8,' + encodeURIComponent(placeholderSVG);
  
  return `
    <div class="thumb-wrap tall lazy" data-id="${game.id}" data-thumb="${imageUrl}">
      <div class="img-spinner"></div>
      <img alt="Game Image" src="${placeholder}" loading="lazy" />
    </div>
    <div class="card-body" data-open="${game.id}">
      <h4 class="g-title renameable" data-rename="${game.id}">${escapeHtml(game.title || 'Untitled')}</h4>
      <div class="g-meta-row">
        <div style="display:flex;flex-direction:column;align-items:flex-start;">
          <p class="g-creator">${game.creator_name || 'Unknown'}</p>
          <p class="g-date">${when}</p>
        </div>
        <button class="del-btn" title="${owned?'Delete':'Not owner'}" data-del="${game.id}" ${owned?'':'disabled style="opacity:.35;cursor:not-allowed;"'}><span class="material-icons" style="font-size:19px;">delete</span></button>
      </div>
    </div>
  `;
}

/**
 * Build file list HTML with filters
 */
export function buildFileListHTML(creators, fileListAllMode) {
  return `
    <div style="margin-bottom: 12px; display: flex; gap: 8px;">
      <input type="text" id="gameSearch" placeholder="Search games by title..." style="flex:1;padding:8px;border:1px solid #ccc;border-radius:4px;" />
      <select id="creatorScope" style="padding:8px;border:1px solid #ccc;border-radius:4px;">
        <option value="mine" ${fileListAllMode ? '' : 'selected'}>My Games</option>
        <option value="all" ${fileListAllMode ? 'selected' : ''}>All Users</option>
      </select>
      <select id="creatorFilter" style="padding:8px;border:1px solid #ccc;border-radius:4px;">
        <option value="">All Creators</option>
        ${creators.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
    </div>
    <div id="gameGrid" class="saved-games-grid"></div>
    <div id="fileListMeta" style="margin-top:8px;font-size:11px;color:#64748b;"></div>
  `;
}
