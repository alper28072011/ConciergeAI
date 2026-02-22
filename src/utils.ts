export const formatTRDate = (dateStr: string) => {
  if (!dateStr) return '';
  
  // Handle "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss" formats
  const datePart = dateStr.split(' ')[0];
  const parts = datePart.split('-');
  
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  
  return dateStr;
};
