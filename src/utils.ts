import { ApiSettings, GuestData, CommentData, CommentDetailData, GroupedCommentDetail, UnifiedTimelineAction } from './types';

export const formatHtmlContent = (content: string | undefined | null) => {
  if (!content) return '';
  
  // Eğer içerik düz metinse (HTML etiketi içermiyorsa)
  if (!/<\/?[a-z][\s\S]*>/i.test(content)) {
    return content.replace(/\n/g, '<br>');
  }

  // HTML ise Margin Collapsing'i önlemek için boş paragrafları zorunlu bloklara çevir
  return content
    .replace(/<p><br><\/p>/g, '<div style="height: 1.5em;"></div>')
    .replace(/<p>\s*<\/p>/g, '<div style="height: 1.5em;"></div>');
};

export const parseElektraActions = (answerString: string | undefined): UnifiedTimelineAction[] => {
  if (!answerString) return [];

  const actions: UnifiedTimelineAction[] = [];
  
  // If the string doesn't contain ">", treat the whole string as a single action without a date
  if (!answerString.includes('>')) {
    actions.push({
      id: `elektra-0-fallback`,
      date: '',
      description: answerString.trim(),
      type: 'elektra',
      source: 'Elektraweb'
    });
    return actions;
  }

  // Split by ">" and filter out empty strings
  const parts = answerString.split('>').map(p => p.trim()).filter(p => p.length > 0);

  parts.forEach((part, index) => {
    // Regex to match DD.MM.YYYY HH:MM at the beginning
    const dateRegex = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})\s*-\s*(.*)/s;
    const match = part.match(dateRegex);

    if (match) {
      const [_, day, month, year, hour, minute, description] = match;
      // Convert to ISO string for sorting
      const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
      
      actions.push({
        id: `elektra-${index}-${dateObj.getTime()}`,
        date: dateObj.toISOString(),
        description: description.trim(),
        type: 'elektra',
        source: 'Elektraweb'
      });
    } else {
      // If it doesn't match the format, just add it as a general note with an empty date
      actions.push({
        id: `elektra-${index}-fallback`,
        date: '',
        description: part,
        type: 'elektra',
        source: 'Elektraweb'
      });
    }
  });

  return actions;
};

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

export const buildUnifiedTimeline = (
  elektraAnswer?: string,
  firebaseActions: any[] = [],
  guestInteractions: any[] = [],
  surveyLogs: any[] = []
): UnifiedTimelineAction[] => {
  const timeline: UnifiedTimelineAction[] = [];

  // 1. Parse Elektra Actions
  if (elektraAnswer) {
    timeline.push(...parseElektraActions(elektraAnswer));
  }

  // 2. Add Firebase Actions (comment_actions)
  firebaseActions.forEach(action => {
    timeline.push({
      id: action.id,
      date: action.date,
      type: action.type,
      description: action.description,
      content: action.content,
      commentId: action.commentId,
      resId: action.resId,
      source: action.source || 'Kullanıcı'
    });
  });

  // 3. Add Guest Interactions (Welcome Call, etc.)
  guestInteractions.forEach(interaction => {
    if (interaction.welcomeCallDate && interaction.welcomeCallStatus) {
      let desc = 'Hoş Geldiniz Araması Yapıldı';
      if (interaction.welcomeCallStatus === 'answered_all_good') desc = 'Hoş Geldiniz Araması Yapıldı: Ulaşıldı - Her şey yolunda';
      else if (interaction.welcomeCallStatus === 'answered_has_request') desc = 'Hoş Geldiniz Araması Yapıldı: Ulaşıldı - Talebi Var';
      else if (interaction.welcomeCallStatus === 'no_answer') desc = 'Hoş Geldiniz Araması Yapıldı: Ulaşılamadı';

      timeline.push({
        id: `welcome_call_${interaction.id || interaction.resId}`,
        date: interaction.welcomeCallDate,
        type: 'welcome_call',
        description: desc,
        content: interaction.welcomeCallNotes || undefined,
        resId: interaction.resId,
        source: 'Sistem'
      });
    }
  });

  // 4. Add Survey Logs
  surveyLogs.forEach(log => {
    timeline.push({
      id: log.id,
      date: log.sentAt,
      type: 'survey_sent',
      description: `Anket Gönderildi: ${log.surveyName || 'Genel Anket'}`,
      resId: log.resId,
      source: 'Sistem'
    });
  });

  // Sort Chronologically (Oldest to Newest)
  return timeline.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateA - dateB;
  });
};
