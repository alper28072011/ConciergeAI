import { ApiSettings, GuestData, CommentData, CommentDetailData, GroupedCommentDetail } from './types';

export const buildDynamicPayload = (
  templateString: string,
  activeSettings: ApiSettings,
  columnFilters: Record<string, string> = {},
  startDate?: string,
  endDate?: string
): any => {
  if (!templateString) {
    throw new Error("Payload şablonu boş olamaz.");
  }

  let processedString = templateString;

  // 0. Auto-fix Legacy Hardcoded Dates
  processedString = processedString.replace(/"Value":\s*"2024-01-01"/g, `"Value": "{{START_DATE}}"`);
  processedString = processedString.replace(/"Value":\s*"2024-12-31"/g, `"Value": "{{END_DATE}}"`);

  // 1. Replace Placeholders
  processedString = processedString.replace(/{{LOGIN_TOKEN}}/g, activeSettings.loginToken || '');
  processedString = processedString.replace(/{{HOTELID}}/g, activeSettings.hotelId || '');
  
  if (startDate !== undefined) processedString = processedString.replace(/{{START_DATE}}/g, startDate || '');
  if (endDate !== undefined) processedString = processedString.replace(/{{END_DATE}}/g, endDate || '');

  // 2. Parse JSON
  let payload: any;
  try {
    payload = JSON.parse(processedString);
  } catch (e) {
    console.error("JSON Parse Error in buildDynamicPayload:", e);
    console.error("Processed String was:", processedString);
    return null;
  }

  // 3. Clean up existing Filters (remove empty values or unresolved placeholders)
  const filterKey = payload.Where ? 'Where' : 'Filters';
  if (payload[filterKey] && Array.isArray(payload[filterKey])) {
    payload[filterKey] = payload[filterKey].filter((f: any) => {
      // If startDate/endDate were not provided, remove filters that still have the placeholder
      if (typeof f.Value === 'string' && (f.Value.includes('{{START_DATE}}') || f.Value.includes('{{END_DATE}}'))) {
        return false;
      }
      // Also remove empty filters that might be left over
      if (f.Value === "" || f.Value === null || f.Value === undefined) {
        return false;
      }
      return true;
    });
  } else {
    payload.Where = [];
  }

  const targetKey = payload.Where ? 'Where' : 'Filters';

  // 4. Append dynamic column filters
  Object.entries(columnFilters).forEach(([key, value]) => {
    if (value && typeof value === 'string' && value.trim() !== '') {
      let finalValue = value.trim();
      let operator = "=";
      
      // If the user types a wildcard, use 'like'
      if (finalValue.includes('%')) {
        operator = "like";
      }

      payload[targetKey].push({
        Column: key,
        Operator: operator,
        Value: finalValue
      });
    }
  });

  return payload;
};

export const formatTRDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long'
  }).format(date);
};

export const groupCommentDetails = (rawDetails: CommentDetailData[]): GroupedCommentDetail[] => {
  if (!rawDetails || rawDetails.length === 0) return [];

  const groupedMap = rawDetails.reduce((acc, curr) => {
    if (!acc[curr.COMMENTID]) {
      acc[curr.COMMENTID] = {
        COMMENTID: curr.COMMENTID,
        COMMENTDATE: curr.COMMENTDATE,
        COMMENT: curr.COMMENT,
        ANSWER: curr.ANSWER,
        SOURCENAME: curr.SOURCENAME,
        FULLNAME: curr.FULLNAME,
        RESID: curr.RESID,
        details: []
      };
    }
    
    if (curr.DEPNAME || curr.GROUPNAME || curr.DETAILTYPE) {
      acc[curr.COMMENTID].details.push({
        depName: curr.DEPNAME || '',
        groupName: curr.GROUPNAME || '',
        type: curr.DETAILTYPE || '',
        detail: curr.DETAIL || ''
      });
    }

    return acc;
  }, {} as Record<number, GroupedCommentDetail>);

  return Object.values(groupedMap);
};
