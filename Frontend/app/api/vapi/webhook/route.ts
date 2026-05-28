import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/admin';
import { updateCallAnalytics } from '@/lib/analysis-ops';

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

function trimForLog(text: string, maxLen = 240) {
  if (!text) return '';
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen)}...`;
}

function extractTranscriptEntries(message: any) {
  if (!message) return [] as Array<{ role: string; content: string }>;

  const type = String(message.type || '').toLowerCase();
  const isTranscript = type.includes('transcript');
  const isConversationUpdate = type.includes('conversation');

  if (isTranscript) {
    const directText =
      message.text ||
      message.transcript?.text ||
      message.transcript ||
      message.message?.text ||
      message.message?.content;

    if (typeof directText === 'string' && directText.trim()) {
      return [
        {
          role: String(message.role || message.speaker || 'unknown'),
          content: directText.trim(),
        },
      ];
    }

    return [];
  }

  if (isConversationUpdate) {
    const messages = message.conversation?.messages || message.messages || [];
    return messages
      .filter((msg: any) => typeof msg?.content === 'string' && msg.content.trim())
      .map((msg: any) => ({
        role: String(msg?.role || 'unknown'),
        content: msg.content.trim(),
      }));
  }

  return [];
}

function extractUserTranscript(message: any) {
  if (!message) return null;

  const type = String(message.type || '').toLowerCase();
  const isTranscript = type.includes('transcript');
  const isConversationUpdate = type.includes('conversation');

  if (isTranscript) {
    if (message.transcriptType && message.transcriptType !== 'final') return null;
    if (message.role && message.role !== 'user') return null;

    const directText =
      message.text ||
      message.transcript?.text ||
      message.transcript ||
      message.message?.text ||
      message.message?.content;

    if (typeof directText === 'string' && directText.trim()) return directText.trim();
    return null;
  }

  if (isConversationUpdate) {
    const messages = message.conversation?.messages || message.messages || [];
    const lastUserMessage = [...messages]
      .reverse()
      .find((msg: any) => msg?.role === 'user' && typeof msg?.content === 'string');

    if (lastUserMessage?.content?.trim()) return lastUserMessage.content.trim();
  }

  return null;
}

function shouldSendWhatsApp(transcript: string) {
  const text = transcript.toLowerCase();
  const sendIntent = /\b(send|share|text|message|whatsapp|dm)\b/;
  const detailIntent = /\b(details?|info|information|registration|link|address|location|venue|schedule|timing|date|food|agenda|tickets?|pricing|fees|contact|brochure|itinerary|map)\b/;
  const whatsappExplicit = /\bwhatsapp\b/;

  return sendIntent.test(text) && (detailIntent.test(text) || whatsappExplicit.test(text));
}

function getCallFromPayload(body: any, message: any) {
  return message?.call || body?.call || message?.callReport?.call || null;
}

/**
 * POST /api/vapi/webhook
 * Handlers Vapi.ai webhooks for call lifecycle events.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log('\n🔴🔴🔴 VAPI WEBHOOK RECEIVED 🔴🔴🔴');
    console.log('Event Type:', body.message?.type);
    console.log('Full Payload:', JSON.stringify(body, null, 2));
    console.log('🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴\n');

    const message = body.message;
    if (!message) {
      console.warn('⚠️ Webhook: No message in body');
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }

    const transcriptEntries = extractTranscriptEntries(message);
    if (transcriptEntries.length > 0) {
      console.log('🗣️  TRANSCRIPTS:');
      transcriptEntries.forEach((entry: { role: string; content: string }) => {
        const label = entry.role === 'assistant' ? 'AGENT' : entry.role === 'user' ? 'USER' : entry.role.toUpperCase();
        console.log(`   ${label}: ${trimForLog(entry.content)}`);
      });
    }

    // Handle Call Ended Event
    const eventType = message.type;
    if (eventType === 'call-ended' || eventType === 'call.ended' || eventType === 'end-of-call-report') {
      const call = message.call;
      const metadata = call?.metadata || {};
      const { userId, campaignId } = metadata;

      if (!userId || !campaignId) {
        console.warn('⚠️ Vapi Webhook: Received event without userId/campaignId in metadata');
        console.log('   Received Metadata:', JSON.stringify(metadata, null, 2));
        return NextResponse.json({ status: 'ignored', reason: 'Missing attribution metadata' });
      }

      console.log(`\n📊 ═══════════════════════════════════════════`);
      console.log(`📊 PROCESSING CALL COMPLETION`);
      console.log(`   Call ID: ${call.id}`);
      console.log(`   Campaign: ${campaignId}`);
      console.log(`   User: ${userId}`);
      console.log(`   Phone: ${call.customer?.number}`);
      console.log(`   Duration: ${call.duration}s`);
      console.log(`   Status: ${call.status}`);
      console.log(`📊 ═══════════════════════════════════════════\n`);

      // 1. Save individual call record
      const callData = {
        callId: call.id,
        timestamp: new Date().toISOString(),
        duration: call.duration || 0,
        status: call.status || 'ended',
        endedReason: call.endedReason || 'unknown',
        customerPhone: call.customer?.number || 'unknown',
        transcript: call.transcript || '',
        summary: call.summary || '',
        cost: call.cost || 0,
      };

      await db
        .collection('users')
        .doc(userId)
        .collection('campaigns')
        .doc(campaignId)
        .collection('calls')
        .doc(call.id)
        .set(callData);

      console.log(`✅ Call record saved to Firestore`);

      // Update analysis collection with call data
      // Determine if call was answered based on duration
      const isAnswered = (call.duration || 0) > 0;
      console.log(`\n🔔 CALL RESULT: ${isAnswered ? '✅ ANSWERED (duration > 0)' : '❌ MISSED (duration = 0)'}\n`);

      await updateCallAnalytics(userId, campaignId, {
        duration: call.duration || 0,
        status: isAnswered ? 'completed' : 'failed',
        customerPhone: call.customer?.number || 'unknown',
      });
      console.log(`✅ Analytics data updated\n`);

      // 2. Optional: Increment campaign-level stats for faster lookup
      const campaignRef = db
        .collection('users')
        .doc(userId)
        .collection('campaigns')
        .doc(campaignId);

      await db.runTransaction(async (transaction) => {
        const campaignDoc = await transaction.get(campaignRef);
        if (campaignDoc.exists) {
          const data = campaignDoc.data() || {};
          const stats = data.vapiStats || {
            totalCalls: 0,
            totalDuration: 0,
            answeredCalls: 0,
          };

          stats.totalCalls += 1;
          stats.totalDuration += call.duration || 0;
          if (call.duration > 0) {
            stats.answeredCalls += 1;
          }

          transaction.update(campaignRef, { vapiStats: stats });
        }
      });
      
      console.log(`📈 Campaign stats updated\n`);
    } else {
      const transcriptText = extractUserTranscript(message);
      if (!transcriptText) {
        console.log(`📌 Ignoring event type: ${eventType}`);
        return NextResponse.json({ status: 'ignored' });
      }

      console.log(`🧩 Transcript for intent check: "${trimForLog(transcriptText, 200)}"`);

      if (!shouldSendWhatsApp(transcriptText)) {
        console.log(`📌 Transcript does not request WhatsApp details`);
        return NextResponse.json({ status: 'ignored' });
      }

      console.log(`✅ Intent detected: send WhatsApp details`);

      const call = getCallFromPayload(body, message);
      const metadata = call?.metadata || {};
      const { userId, campaignId } = metadata;
      const phone = call?.customer?.number || call?.customer?.phoneNumber;
      const callId = call?.id || message?.callId || 'unknown';

      if (!userId || !campaignId || !phone) {
        console.warn('⚠️ Missing userId/campaignId/phone for WhatsApp detail request');
        return NextResponse.json({ status: 'ignored', reason: 'missing-metadata' });
      }

      const requestId = `${callId}_${hashString(transcriptText)}`;
      const requestRef = db
        .collection('users')
        .doc(userId)
        .collection('campaigns')
        .doc(campaignId)
        .collection('callRequests')
        .doc(requestId);

      const existing = await requestRef.get();
      if (existing.exists) {
        console.log(`📌 Duplicate call request ignored: ${requestId}`);
        return NextResponse.json({ status: 'ignored', reason: 'duplicate' });
      }

      await requestRef.set({
        callId,
        phone,
        requestText: transcriptText,
        source: 'vapi',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      console.log(`📤 Dispatching WhatsApp detail request → ${phone}`);

      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
      try {
        const waRes = await fetch(`${backendUrl}/api/whatsapp/send-call-details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            requestText: transcriptText,
            userId,
            campaignId,
            callId,
          }),
        });

        const waData = await waRes.json();
        if (!waRes.ok) {
          await requestRef.set({
            status: 'failed',
            error: waData?.error || 'Unknown error',
          }, { merge: true });

          console.error('❌ WhatsApp detail send failed:', waData?.error || waRes.statusText);
          return NextResponse.json({ status: 'error', error: waData?.error || waRes.statusText });
        }

        await requestRef.set({
          status: 'sent',
          messageId: waData?.messageId || null,
          reply: waData?.reply || null,
        }, { merge: true });

        console.log(`✅ WhatsApp details sent to ${phone}`);
      } catch (sendErr: any) {
        await requestRef.set({
          status: 'failed',
          error: sendErr?.message || 'Unknown error',
        }, { merge: true });
        console.error('❌ WhatsApp detail send error:', sendErr?.message || sendErr);
        return NextResponse.json({ status: 'error', error: sendErr?.message || 'Unknown error' });
      }
    }

    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    console.error('\n❌ WEBHOOK ERROR ❌');
    console.error('Error Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('❌❌❌❌❌❌❌❌❌\n');
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
