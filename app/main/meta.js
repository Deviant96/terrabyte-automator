'use strict';

const https = require('https');
const crypto = require('crypto');
const config = require('./config');

const DEFAULT_GRAPH_VERSION = 'v21.0';

function buildAppSecretProof(accessToken, appSecret) {
  if (!accessToken || !appSecret) return '';
  return crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');
}

function graphGet(pathname, accessToken, appSecret, graphVersion) {
  const version = graphVersion || DEFAULT_GRAPH_VERSION;
  const proof = buildAppSecretProof(accessToken, appSecret);
  const params = new URLSearchParams({ access_token: accessToken });
  if (proof) params.set('appsecret_proof', proof);

  const pathWithQuery = pathname.includes('?')
    ? `${pathname}&${params.toString()}`
    : `${pathname}?${params.toString()}`;

  const options = {
    hostname: 'graph.facebook.com',
    path: `/${version}${pathWithQuery}`,
    method: 'GET',
    headers: { Accept: 'application/json' }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch {
          return reject(new Error('Invalid JSON from Meta Graph API.'));
        }

        if (res.statusCode >= 400 || parsed?.error) {
          const msg = parsed?.error?.message || `HTTP ${res.statusCode}`;
          return reject(new Error(msg));
        }

        resolve(parsed);
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Meta Graph API request timed out.'));
    });
    req.end();
  });
}

async function fetchAllPages(accessToken, appSecret, graphVersion) {
  const pages = [];
  let path = '/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name}&limit=100';

  while (path) {
    // graphGet expects pathname relative to version; next paging URLs are absolute
    let data;
    if (path.startsWith('http')) {
      data = await graphGetAbsolute(path);
    } else {
      data = await graphGet(path, accessToken, appSecret, graphVersion);
    }

    if (Array.isArray(data.data)) pages.push(...data.data);

    const next = data.paging?.next || '';
    path = next || null;
  }

  return pages;
}

function graphGetAbsolute(absoluteUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(absoluteUrl);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { Accept: 'application/json' }
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch {
          return reject(new Error('Invalid JSON from Meta Graph API.'));
        }
        if (res.statusCode >= 400 || parsed?.error) {
          const msg = parsed?.error?.message || `HTTP ${res.statusCode}`;
          return reject(new Error(msg));
        }
        resolve(parsed);
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Meta Graph API request timed out.'));
    });
    req.end();
  });
}

function makeId(prefix, accountId) {
  return `meta-${prefix}-${accountId}`;
}

function buildSyncedAccounts(pages) {
  const now = new Date().toISOString();
  const accounts = [];

  for (const page of pages) {
    const pageId = String(page.id || '');
    const pageToken = page.access_token || '';
    const pageName = page.name || `Facebook Page ${pageId}`;

    if (!pageId || !pageToken) continue;

    accounts.push({
      id: makeId('fb', pageId),
      platform: 'facebook',
      label: pageName,
      account_id: pageId,
      access_token: pageToken,
      notes: 'Synced from Meta System User',
      source: 'meta_sync',
      page_id: pageId,
      synced_at: now
    });

    const ig = page.instagram_business_account;
    if (ig?.id) {
      const igId = String(ig.id);
      const igLabel = ig.username
        ? `@${ig.username}`
        : (ig.name || `Instagram ${igId}`);

      accounts.push({
        id: makeId('ig', igId),
        platform: 'instagram',
        label: igLabel,
        account_id: igId,
        access_token: pageToken,
        notes: `Synced from Meta · linked Page ${pageName} (${pageId})`,
        source: 'meta_sync',
        page_id: pageId,
        synced_at: now
      });
    }
  }

  return accounts;
}

function mergeSyncedAccounts(existingAccounts, syncedAccounts) {
  const existing = Array.isArray(existingAccounts) ? existingAccounts.slice() : [];
  const keepManual = existing.filter((a) => a?.source !== 'meta_sync');

  // Upsert synced by platform + account_id (prefer stable meta ids)
  const byKey = new Map();
  for (const account of syncedAccounts) {
    byKey.set(`${account.platform}:${account.account_id}`, account);
  }

  // Preserve any manual FB/IG that don't collide with synced IDs
  const syncedKeys = new Set(byKey.keys());
  const manualNonColliding = keepManual.filter((a) => {
    const key = `${a.platform}:${a.account_id}`;
    return !syncedKeys.has(key);
  });

  return [...manualNonColliding, ...Array.from(byKey.values())];
}

/**
 * Sync Facebook Pages + linked Instagram Business accounts from a System User token.
 * @param {{ systemUserToken?: string, appSecret?: string, graphVersion?: string, persist?: boolean }} options
 */
async function syncFacebookInstagram(options = {}) {
  const settings = config.getAll();
  const systemUserToken = (options.systemUserToken || settings.meta_system_user_token || '').trim();
  const appSecret = (options.appSecret || settings.meta_app_secret || '').trim();
  const graphVersion = (options.graphVersion || settings.meta_graph_version || DEFAULT_GRAPH_VERSION).trim();
  const persist = options.persist !== false;

  if (!systemUserToken) {
    return { success: false, message: 'System User token is required.', accounts: [], facebook: 0, instagram: 0 };
  }

  try {
    const pages = await fetchAllPages(systemUserToken, appSecret, graphVersion);
    if (!pages.length) {
      return {
        success: false,
        message: 'No Facebook Pages found for this System User. Assign Pages to the system user in Business Manager.',
        accounts: settings.social_accounts || [],
        facebook: 0,
        instagram: 0
      };
    }

    const synced = buildSyncedAccounts(pages);
    const facebook = synced.filter((a) => a.platform === 'facebook').length;
    const instagram = synced.filter((a) => a.platform === 'instagram').length;
    const merged = mergeSyncedAccounts(settings.social_accounts, synced);

    if (persist) {
      config.setAll({
        meta_system_user_token: systemUserToken,
        meta_app_secret: appSecret,
        meta_graph_version: graphVersion,
        social_accounts: merged
      });
    }

    return {
      success: true,
      message: `Synced ${facebook} Facebook page(s) and ${instagram} Instagram account(s).`,
      accounts: merged,
      facebook,
      instagram,
      pages_found: pages.length
    };
  } catch (err) {
    return {
      success: false,
      message: err.message || 'Meta sync failed.',
      accounts: settings.social_accounts || [],
      facebook: 0,
      instagram: 0
    };
  }
}

module.exports = { syncFacebookInstagram, DEFAULT_GRAPH_VERSION };
