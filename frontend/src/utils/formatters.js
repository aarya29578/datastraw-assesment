export function formatStatus(status) {
  if (!status) return '';
  return status.replace(/_/g, ' ');
}

export function truncateText(text, maxLength = 60) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function formatPhoneNumber(phone) {
  if (!phone) return '-';
  return phone;
}
