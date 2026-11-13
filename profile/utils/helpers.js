import { MEDIA_URL } from './constants.js';

const toUtc = (s) => typeof s === 'string' && !s.includes('T') && !s.endsWith('Z') ? s.replace(' ', 'T') + 'Z' : s;

// One time-ago style across the app: "5m ago", "18h ago", "3d ago", then the date
export const formatTimeAgo = (dateStr, refDateStr) => {
  if (!dateStr) return "Never";
  const date = new Date(toUtc(dateStr));
  const now = new Date(toUtc(refDateStr));
  const diffMs = now - date;
  const diffHrs = diffMs / (1000 * 60 * 60);
  const diffDays = diffHrs / 24;

  if (diffHrs < 1) {
    return `${Math.max(1, Math.floor(diffMs / (1000 * 60)))}m ago`;
  } else if (diffHrs < 24) {
    return `${Math.floor(diffHrs)}h ago`;
  } else if (diffDays < 7) {
    return `${Math.floor(diffDays)}d ago`;
  } else {
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
};

export const formatDate = (dateStr) => {
  if (!dateStr) return "";
  return new Date(toUtc(dateStr)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${MEDIA_URL}${path.startsWith('/') ? path : '/' + path}`;
};

export const parseTitle = (title) => {
  if (!title) return { baseTitle: title, subsetName: null, isSubset: false, tags: [] };

  const tags = [];
  const withoutTags = title.replace(/~([^~]+)~\s*/g, (_, tag) => { tags.push(tag); return ''; }).trim();

  // Match [Subset - Name] with any dash variant (hyphen, en-dash, em-dash)
  const subsetMatch = withoutTags.match(/^(.+?)\s*\[Subset\s*[-\u2013\u2014]\s*(.+?)\]\s*$/i);
  if (subsetMatch) {
    return { baseTitle: subsetMatch[1].trim(), subsetName: subsetMatch[2].trim(), isSubset: true, tags };
  }

  return { baseTitle: withoutTags, subsetName: null, isSubset: false, tags };
};
