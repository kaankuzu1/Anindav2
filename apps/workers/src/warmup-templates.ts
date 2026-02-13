// Warmup email templates with personalization via the shared template variable system.
// Uses {{firstName|there}} for recipient greeting and {{senderFirstName}} for sender sign-off.
// Bodies are 2-4 paragraphs, 40-120 words, professional business tone.

export interface WarmupTemplate {
  subject: string;
  body: string;
}

// ============================================================
// 105 MAIN TEMPLATES (initial warmup emails)
// ============================================================

export const WARMUP_TEMPLATES: WarmupTemplate[] = [

  // ─── Meeting & Scheduling (15) ────────────────────────────

  {
    subject: 'Quick sync this week?',
    body: `Hi {{firstName|there}},

I was looking at my calendar and realized we haven't connected in a while. Would you have 15-20 minutes this week for a quick sync? I have a few things I'd love to run by you.

Let me know what works on your end and I'll send over an invite.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Following up on our meeting',
    body: `Hi {{firstName|there}},

Just wanted to follow up on the points we discussed in our last meeting. I've had a chance to review everything and I think we're in a good position to move forward.

I'll put together a brief summary and share it by end of week. Let me know if there's anything specific you'd like me to include.

Talk soon,
{{senderFirstName}}`,
  },
  {
    subject: 'Can we reschedule to next week?',
    body: `Hi {{firstName|there}},

Something came up on my end and I'm wondering if we could push our meeting to next week instead. I want to make sure I can give it my full attention.

Would Tuesday or Wednesday work for you? Happy to adjust to whatever fits your schedule best.

Thanks for understanding,
{{senderFirstName}}`,
  },
  {
    subject: 'Meeting notes from today',
    body: `Hi {{firstName|there}},

Thanks for taking the time to meet today. I really appreciated the discussion and feel like we covered a lot of ground.

I'll clean up my notes and share them with you tomorrow. In the meantime, let me know if anything else comes to mind that you'd like to add to the agenda for next time.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: 'Scheduling a quick call',
    body: `Hi {{firstName|there}},

I've been thinking about a few things and I think a quick call would be more efficient than going back and forth over email. Would you have 10 minutes sometime this week?

No preparation needed — just a casual conversation to align on next steps.

Looking forward to it,
{{senderFirstName}}`,
  },
  {
    subject: 'Time for a brief catch-up?',
    body: `Hi {{firstName|there}},

It's been a while since we last spoke and I wanted to check in. Things have been moving quickly on my end and I'd love to hear how things are going with you.

Would you be open to a quick catch-up call sometime in the next few days? I'm flexible on timing.

Best regards,
{{senderFirstName}}`,
  },
  {
    subject: 'Confirming our call for tomorrow',
    body: `Hi {{firstName|there}},

Just a quick note to confirm our call tomorrow. I've added a few topics I'd like to cover, but nothing too heavy — should be a straightforward conversation.

If anything changes on your end, just let me know. Otherwise, I'll talk to you then.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Pushed our meeting — new time?',
    body: `Hi {{firstName|there}},

Apologies for the last-minute change, but I need to move our meeting. My schedule shifted unexpectedly and I want to make sure we have enough time to talk properly.

Could we try Thursday afternoon instead? I'm also open to Friday morning if that works better for you.

Thanks,
{{senderFirstName}}`,
  },
  {
    subject: 'Great conversation today',
    body: `Hi {{firstName|there}},

Really enjoyed our conversation today. You brought up some great points that I hadn't considered before, and I think they'll be really valuable as we move forward.

I'll follow up with the details we discussed. In the meantime, feel free to reach out if anything else comes up.

Take care,
{{senderFirstName}}`,
  },
  {
    subject: 'Quick coffee chat?',
    body: `Hi {{firstName|there}},

I know we're both busy, but I was wondering if you'd be up for a quick coffee chat sometime this week. Nothing formal — just thought it would be nice to connect in person for a change.

Let me know if you're free and I'll suggest a place that's convenient for both of us.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: 'Setting up recurring check-ins',
    body: `Hi {{firstName|there}},

I was thinking it might be helpful for us to set up a regular check-in, maybe biweekly or monthly. That way we can stay aligned without having to coordinate schedules each time.

What do you think? If you're open to it, I'll send over a recurring invite.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Agenda for our meeting',
    body: `Hi {{firstName|there}},

I'm putting together a quick agenda for our upcoming meeting and wanted to see if there's anything specific you'd like to discuss. So far I have a couple of items on my list, but I want to make sure we cover what matters most to you.

Just drop me a note and I'll add it in.

Thanks,
{{senderFirstName}}`,
  },
  {
    subject: 'Free for a 15-minute chat?',
    body: `Hi {{firstName|there}},

I have a quick question that I think would be easier to discuss over a call than over email. Nothing urgent, but I'd appreciate your input when you have a few minutes.

Would any time this week work for a brief chat? I'll keep it to 15 minutes.

Thanks in advance,
{{senderFirstName}}`,
  },
  {
    subject: 'Thank you for meeting today',
    body: `Hi {{firstName|there}},

Thank you for making the time to meet today. I know your schedule is packed and I really appreciate it. The insights you shared were exactly what I needed to hear.

I'll follow up with the action items by tomorrow. Looking forward to our next conversation.

Warm regards,
{{senderFirstName}}`,
  },
  {
    subject: 'Prep notes for our call',
    body: `Hi {{firstName|there}},

Just wanted to share a few notes ahead of our call so we can make the most of our time. I've been looking into the topics we flagged last time and have a few updates to share.

Nothing to review beforehand — I'll walk through everything during the call. See you then.

Best,
{{senderFirstName}}`,
  },

  // ─── Project Updates (15) ─────────────────────────────────

  {
    subject: 'Quick update on our progress',
    body: `Hi {{firstName|there}},

Wanted to give you a quick update on where things stand. We've made solid progress this week and are on track with the timeline we discussed.

I'll put together a more detailed summary soon, but wanted to keep you in the loop in the meantime. Let me know if you have any questions.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Status update — things are moving along',
    body: `Hi {{firstName|there}},

Just a brief status update from my end. Everything is progressing well and I don't foresee any major blockers at this point.

There are a couple of minor items I want to flag, but nothing that should delay things. I'll share more details in our next check-in.

Thanks,
{{senderFirstName}}`,
  },
  {
    subject: 'Project milestone reached',
    body: `Hi {{firstName|there}},

Happy to report that we've hit an important milestone. It took a bit more effort than expected, but the results are looking really promising.

I'll send over a detailed recap by end of week. In the meantime, wanted to share the good news while it's fresh.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: 'Some news to share',
    body: `Hi {{firstName|there}},

I have some updates that I think you'll find interesting. Things have been evolving on our end and I wanted to make sure you're in the loop before our next meeting.

Nothing urgent, but I'd love to hear your thoughts when you have a moment. Feel free to call or just shoot me a reply.

Best regards,
{{senderFirstName}}`,
  },
  {
    subject: 'Progress report — looking good',
    body: `Hi {{firstName|there}},

Wanted to send a quick progress report. We've completed the main items on our list and are now working through the remaining details.

Everything is on schedule and I'm feeling optimistic about the outcome. I'll keep you posted as we get closer to the finish line.

Talk soon,
{{senderFirstName}}`,
  },
  {
    subject: 'Wrapped up the first phase',
    body: `Hi {{firstName|there}},

Just wanted to let you know that we've finished the first phase. The results are in line with what we expected, and in some areas we're actually ahead of where I thought we'd be.

I'm putting together next steps now and will share them with you shortly. Appreciate your support through this.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Updates from this week',
    body: `Hi {{firstName|there}},

Quick roundup of what happened this week. Made good headway on the main priorities and resolved a couple of open questions that had been lingering.

Still a few things in progress, but overall I'm happy with where we are. Let me know if you'd like a more detailed breakdown.

Thanks,
{{senderFirstName}}`,
  },
  {
    subject: 'Brief status update',
    body: `Hi {{firstName|there}},

Keeping this short — just wanted to let you know that everything is on track. No surprises, no blockers, just steady progress.

I'll have a more comprehensive update for you next week. In the meantime, don't hesitate to reach out if you need anything.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Wanted to keep you in the loop',
    body: `Hi {{firstName|there}},

A few things have developed since we last spoke and I wanted to make sure you're up to speed. Nothing major, but some of the details have shifted a bit.

I'll walk you through everything in our next meeting, but wanted to give you a heads up now so there are no surprises.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: 'Exciting progress to report',
    body: `Hi {{firstName|there}},

I'm excited to share that we've made some really encouraging progress lately. The approach we discussed is working well and we're already seeing positive results.

I know it's early, but I'm optimistic about where this is heading. Would love to discuss more when you're free.

Best regards,
{{senderFirstName}}`,
  },
  {
    subject: 'Quick heads up on a change',
    body: `Hi {{firstName|there}},

Wanted to flag a small change before you hear about it elsewhere. It's nothing major, but I thought it was important to keep you informed directly.

I'm happy to explain the reasoning behind it whenever works for you. It's actually a positive adjustment overall.

Thanks,
{{senderFirstName}}`,
  },
  {
    subject: 'Weekly update — all systems go',
    body: `Hi {{firstName|there}},

Here's your weekly update from my end. In short: everything is moving along nicely. We hit our targets for the week and are well-positioned for next week.

If there's anything specific you'd like me to dig into, just let me know. Otherwise, I'll continue at the current pace.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Sharing a quick win',
    body: `Hi {{firstName|there}},

Had a small but meaningful win today that I wanted to share. It's one of those things that looked tricky at first but turned out to have a really clean solution.

The details aren't critical, but I thought you'd appreciate knowing that things are clicking into place. More to come.

Talk soon,
{{senderFirstName}}`,
  },
  {
    subject: 'End of month review notes',
    body: `Hi {{firstName|there}},

As we wrap up the month, I wanted to share a few highlights. Overall it's been a productive period and I'm pleased with the direction things are going.

I'll put together a more formal review if needed, but wanted to share the high-level summary while it's fresh. Let me know your thoughts.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Roadmap update',
    body: `Hi {{firstName|there}},

I've been revisiting our roadmap and I think a few adjustments could help us stay focused on what matters most. Nothing drastic — just some reordering based on what we've learned recently.

Would love to get your perspective before I finalize anything. Let me know when you have a few minutes.

Thanks,
{{senderFirstName}}`,
  },

  // ─── Follow-ups (15) ──────────────────────────────────────

  {
    subject: 'Circling back on this',
    body: `Hi {{firstName|there}},

I wanted to circle back on our earlier conversation. I know things can get busy, so I thought a quick follow-up might be helpful.

No pressure at all — just wanted to keep this on your radar. Let me know when would be a good time to reconnect.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Following up as promised',
    body: `Hi {{firstName|there}},

As promised, I'm following up with the information we discussed. I've had a chance to review everything and I think we're in good shape.

Let me know if you have any questions or if there's anything else you'd need from my side.

Thanks,
{{senderFirstName}}`,
  },
  {
    subject: 'Just checking in',
    body: `Hi {{firstName|there}},

Hope everything's going well. I wanted to check in and see how things are progressing on your end. I've wrapped up the items we discussed and am ready to move forward whenever you are.

No rush — just keeping the conversation going.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: 'Any updates on this?',
    body: `Hi {{firstName|there}},

I was wondering if there were any updates on what we talked about. I've been thinking it over and have a few additional thoughts that might be useful.

Happy to discuss whenever works for you. In the meantime, I'll keep working on things from my end.

Best regards,
{{senderFirstName}}`,
  },
  {
    subject: 'Touching base',
    body: `Hi {{firstName|there}},

Just touching base to see how things are going. I know you mentioned you had a lot on your plate, so I wanted to check in without adding any pressure.

Whenever you're ready to pick this back up, I'm here. No rush at all.

Warm regards,
{{senderFirstName}}`,
  },
  {
    subject: 'Following up on our last call',
    body: `Hi {{firstName|there}},

Thanks again for the great call. I've been reflecting on what we discussed and I think there's a real opportunity here.

I've started working on a few of the ideas we brainstormed. I'll share my progress once I have something more concrete to show.

Talk soon,
{{senderFirstName}}`,
  },
  {
    subject: 'Wanted to reconnect',
    body: `Hi {{firstName|there}},

It's been a while and I wanted to reconnect. I hope things are going well for you. A few things have come up on my end that made me think of our previous conversations.

Would love to catch up when you have time. Even a quick call would be great.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Checking in on next steps',
    body: `Hi {{firstName|there}},

I was reviewing my notes and wanted to check in on the next steps we identified. I've completed everything on my action list and wanted to see where things stand on your side.

Let me know if there's anything else I can help with to keep things moving.

Thanks,
{{senderFirstName}}`,
  },
  {
    subject: 'Per our earlier discussion',
    body: `Hi {{firstName|there}},

Per our earlier discussion, I wanted to share a few thoughts that have come up since we last spoke. I think they might add some useful context to what we've been working on.

Happy to elaborate if any of this resonates. Just let me know.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: 'Loop closed on my end',
    body: `Hi {{firstName|there}},

Wanted to let you know that I've wrapped up everything we discussed on my end. All the loose threads are tied up and I'm ready for whatever comes next.

Take your time reviewing and let me know if you have any feedback or questions.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Keeping the momentum going',
    body: `Hi {{firstName|there}},

Just a quick note to keep things moving. I know we've both been busy, but I didn't want too much time to pass without checking in.

I'm still excited about what we discussed and I'd love to keep the momentum going. Let me know when's a good time to continue.

Best regards,
{{senderFirstName}}`,
  },
  {
    subject: 'One more thing from our conversation',
    body: `Hi {{firstName|there}},

I was going through my notes from our last conversation and realized there was one more point I wanted to bring up. It's not urgent, but I think it could be valuable to discuss.

When you have a free moment, I'd love to hear your take on it.

Thanks,
{{senderFirstName}}`,
  },
  {
    subject: 'Revisiting our plan',
    body: `Hi {{firstName|there}},

I've been revisiting the plan we put together and I think it's holding up well. There might be a few areas worth tweaking, but overall I'm feeling good about the direction.

Let me know if you'd like to revisit anything specific. I'm flexible.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Gentle reminder',
    body: `Hi {{firstName|there}},

Just a gentle reminder about the items we discussed. I know things can slip through the cracks when it gets busy, so I thought a friendly nudge might be welcome.

No rush at all — just whenever you get a chance. Thanks for keeping this in mind.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: 'As we discussed',
    body: `Hi {{firstName|there}},

As we discussed, I'm moving forward with the approach we agreed on. I'll keep you updated on progress and flag anything that needs your input along the way.

In the meantime, if anything changes on your end, just give me a heads up.

Best,
{{senderFirstName}}`,
  },

  // ─── Questions & Advice (15) ──────────────────────────────

  {
    subject: 'Quick question for you',
    body: `Hi {{firstName|there}},

I had a quick question come up and thought you might be the best person to ask. It's about something I've been working on and I could really use a fresh perspective.

No rush on a response — whenever you have a moment would be great. Thanks in advance.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Would love your input',
    body: `Hi {{firstName|there}},

I'm working through a decision and I'd really value your input. You have a knack for seeing things from angles I might miss, and I think your perspective would be incredibly helpful.

Would you have a few minutes to chat about it? I promise to keep it brief.

Thanks,
{{senderFirstName}}`,
  },
  {
    subject: 'Your thoughts on something?',
    body: `Hi {{firstName|there}},

I've been mulling over an idea and I'd love to hear your thoughts. You always have great insights and I think your opinion could help me decide on the best path forward.

Feel free to shoot me a quick reply or we can hop on a call — whatever's easier for you.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: 'Need your expertise',
    body: `Hi {{firstName|there}},

Something came up recently that's right in your area of expertise. I'd love to pick your brain when you have some time. It shouldn't take more than a few minutes.

Let me know if you're available this week and I'll share the details.

Many thanks,
{{senderFirstName}}`,
  },
  {
    subject: 'Could use your advice',
    body: `Hi {{firstName|there}},

I've been going back and forth on something and could really use your advice. I trust your judgment on these things and I think a brief conversation could help me sort it out.

Would you be open to a quick chat? I'm flexible on timing.

Best regards,
{{senderFirstName}}`,
  },
  {
    subject: 'Curious about your experience with this',
    body: `Hi {{firstName|there}},

I've been exploring a new approach and I remembered that you have experience with something similar. I'd love to learn from what worked for you and what didn't.

If you have a few minutes, I'd really appreciate hearing your perspective. No pressure though.

Thanks,
{{senderFirstName}}`,
  },
  {
    subject: 'Picking your brain on an idea',
    body: `Hi {{firstName|there}},

I have an idea I've been kicking around and I think you'd have some really valuable feedback. It's still in the early stages, so I'm not looking for anything formal — just your honest reaction.

Would you be up for a quick brainstorm? Could be fun.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: 'A question about your process',
    body: `Hi {{firstName|there}},

I've always admired how you handle certain things and I was wondering if you'd be willing to share a bit about your process. I'm trying to improve my own approach and I think learning from you would make a big difference.

Totally understand if you're too busy, but I thought it was worth asking.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Got a minute? Quick question',
    body: `Hi {{firstName|there}},

Sorry to bother you — I have a quick question that I think you can answer in about 30 seconds. It's one of those things where I could spend an hour researching or just ask someone who already knows.

If you have a moment, I'd really appreciate it. Thanks!

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Seeking your perspective',
    body: `Hi {{firstName|there}},

I find myself at a crossroads on a decision and I'm actively seeking perspectives from people I respect. Your input would carry a lot of weight in helping me think this through.

I've prepared a brief overview — would you be willing to take a look and share your thoughts?

Thanks in advance,
{{senderFirstName}}`,
  },
  {
    subject: 'What would you recommend?',
    body: `Hi {{firstName|there}},

I'm evaluating a few options and I'm not sure which way to go. Before I commit to anything, I wanted to ask — what would you recommend in this situation?

Even a quick off-the-cuff response would be helpful. I know you've navigated similar decisions before.

Many thanks,
{{senderFirstName}}`,
  },
  {
    subject: 'Thought you might know the answer',
    body: `Hi {{firstName|there}},

A question came up today and you were the first person I thought of. It's something I know you've dealt with before and I figured you might have a quick answer.

When you get a chance, I'd love to hear your thoughts. No urgency at all.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Your opinion matters to me',
    body: `Hi {{firstName|there}},

I'm putting together my thinking on something and I really value your opinion on it. You always bring a thoughtful perspective that helps me see the full picture.

Would you mind taking a look when you have a quiet moment? I'll keep my summary brief.

Warm regards,
{{senderFirstName}}`,
  },
  {
    subject: 'Help me think through this?',
    body: `Hi {{firstName|there}},

I've been wrestling with a decision and I think talking it through with someone would really help. Would you be open to being my sounding board for a few minutes?

I'm not looking for a definitive answer — just thinking out loud with someone who gets it.

Thanks,
{{senderFirstName}}`,
  },
  {
    subject: 'Wondering how you handled this',
    body: `Hi {{firstName|there}},

I recall you once mentioned dealing with a situation similar to what I'm facing now. I was wondering how you handled it and if you had any lessons learned you'd be willing to share.

Any insight would be a huge help. I know how valuable your time is, so I appreciate you considering it.

Best,
{{senderFirstName}}`,
  },

  // ─── Sharing Resources (10) ───────────────────────────────

  {
    subject: 'Thought you might find this useful',
    body: `Hi {{firstName|there}},

I came across something today that immediately made me think of you. It's related to what we've been discussing and I think you'd find it genuinely useful.

I'll send over the details in a follow-up. Just wanted to let you know it's coming your way.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Came across this and thought of you',
    body: `Hi {{firstName|there}},

I was doing some reading today and stumbled upon something that reminded me of our conversation. I think you'd appreciate it — it touches on a few of the points you raised.

Take a look when you have time and let me know what you think. Always curious to hear your take.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: 'A resource worth checking out',
    body: `Hi {{firstName|there}},

I recently discovered a great resource that I think would be right up your alley. It covers some of the topics we've been exploring and adds some perspectives I hadn't considered.

I'll share the details — let me know if it resonates with you.

Best regards,
{{senderFirstName}}`,
  },
  {
    subject: 'Sharing something interesting',
    body: `Hi {{firstName|there}},

I found something really interesting that I wanted to pass along. It's not directly related to what we're working on, but I think it could spark some good ideas.

No need to respond — just thought you'd enjoy it. But if you do have thoughts, I'm all ears.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: 'You might like this',
    body: `Hi {{firstName|there}},

I know you've been interested in some of the themes we've discussed, so I wanted to point you toward something I recently found. It's well worth the read and I think it aligns with your thinking.

Let me know if you'd like me to share more similar finds in the future.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Saving this for you',
    body: `Hi {{firstName|there}},

I came across something that I immediately bookmarked to share with you. It's relevant to the challenges you mentioned and I think it could be a real game-changer.

I'll compile my notes and send them your way soon. Stay tuned.

Talk soon,
{{senderFirstName}}`,
  },
  {
    subject: 'This reminded me of our chat',
    body: `Hi {{firstName|there}},

I was going through some material today and found something that instantly reminded me of our recent chat. It builds on some of the ideas we were exploring.

Thought you'd appreciate seeing it. Let me know what you think when you get a chance.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Passing along a great find',
    body: `Hi {{firstName|there}},

I stumbled upon something that I think is too good not to share. It relates to some of the topics we've been discussing and offers a fresh angle I hadn't seen before.

Take a look when you have a moment — I'd be curious to hear your reaction.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: 'Something worth your time',
    body: `Hi {{firstName|there}},

I don't usually send things like this unprompted, but I genuinely think this is worth your time. It's concise, insightful, and directly relevant to what you've been working on.

Have a look and let me know if it's helpful. Always happy to share more.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Bookmarked this for you',
    body: `Hi {{firstName|there}},

I've been meaning to share this with you. It came up in a conversation I had recently and I immediately thought it would be valuable for you too.

No rush to review it — just wanted to make sure it didn't fall off my radar. Let me know your thoughts whenever.

Best regards,
{{senderFirstName}}`,
  },

  // ─── Thank You & Appreciation (10) ────────────────────────

  {
    subject: 'Thanks for your help',
    body: `Hi {{firstName|there}},

I just wanted to take a moment to thank you for your help recently. Your support made a real difference and I genuinely appreciate you taking the time.

It's great working with people who are so generous with their time and knowledge. Thanks again.

Warm regards,
{{senderFirstName}}`,
  },
  {
    subject: 'Really appreciated your input',
    body: `Hi {{firstName|there}},

I wanted to let you know how much I appreciated your input on our recent discussion. Your perspective helped me see things more clearly and I feel much more confident about the direction now.

Thank you for always being so thoughtful and thorough. It means a lot.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Thank you — it made a difference',
    body: `Hi {{firstName|there}},

I wanted to circle back and thank you properly. The advice you gave me turned out to be exactly what I needed. It made a real impact and I wanted you to know that.

I owe you one. Let me know if there's ever anything I can do to return the favor.

Many thanks,
{{senderFirstName}}`,
  },
  {
    subject: 'Grateful for your time',
    body: `Hi {{firstName|there}},

Just a quick note to express my gratitude. I know how busy you are, and the fact that you made time to help me really says a lot. I don't take it for granted.

Thank you for being so generous with your time and expertise. Looking forward to finding ways to reciprocate.

Best regards,
{{senderFirstName}}`,
  },
  {
    subject: 'Your advice was spot on',
    body: `Hi {{firstName|there}},

Remember that advice you gave me? Well, I followed through on it and it worked out even better than I expected. I just wanted you to know that your guidance was spot on.

Thanks for always being willing to share your insights. It's truly appreciated.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: 'Thank you for being so supportive',
    body: `Hi {{firstName|there}},

I've been reflecting on the support I've received lately and I wanted to make sure I thanked you directly. Your encouragement has been really motivating and it hasn't gone unnoticed.

Thank you for always being in my corner. It makes a bigger difference than you might realize.

Warmly,
{{senderFirstName}}`,
  },
  {
    subject: 'Appreciate the quick response',
    body: `Hi {{firstName|there}},

Just wanted to say thanks for getting back to me so quickly. I know you're juggling a lot, and the fast turnaround really helped me keep things on track.

Your responsiveness is always appreciated. Thanks for being so reliable.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Thanks for going above and beyond',
    body: `Hi {{firstName|there}},

I wanted to acknowledge the extra effort you put in recently. You went above and beyond what was expected and it made a meaningful difference.

Not everyone takes that kind of initiative, so I wanted to make sure you know it's noticed and valued.

Thank you,
{{senderFirstName}}`,
  },
  {
    subject: 'A quick thank you',
    body: `Hi {{firstName|there}},

This is just a brief note to say thank you. Sometimes the small gestures make the biggest impact, and I wanted to make sure I acknowledged yours.

You made my week a little easier and I'm grateful for it. Thanks for being you.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Your generosity means a lot',
    body: `Hi {{firstName|there}},

I was just thinking about how generous you've been with your time and expertise recently. It really means a lot and I want you to know that it hasn't gone unnoticed.

Thank you for everything. I hope I can pay it forward sometime soon.

Warm regards,
{{senderFirstName}}`,
  },

  // ─── Casual Check-ins (10) ────────────────────────────────

  {
    subject: 'Hope you had a great weekend',
    body: `Hi {{firstName|there}},

Hope you had a great weekend! Just wanted to check in and see how you're doing. Things have been good on my end — keeping busy but in a good way.

How's everything going with you? Would love to hear what you've been up to.

Take care,
{{senderFirstName}}`,
  },
  {
    subject: 'How are things going?',
    body: `Hi {{firstName|there}},

It's been a little while since we connected and I wanted to see how things are going. I hope everything is well with you and that work-life balance is treating you right.

Drop me a line when you get a chance — would be great to catch up.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Been thinking about our conversation',
    body: `Hi {{firstName|there}},

I've been thinking about our last conversation and it left a really positive impression. You brought up some ideas that I've been turning over in my mind since then.

Hope all is well with you. Let's find time to continue that discussion soon.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: 'Happy Monday!',
    body: `Hi {{firstName|there}},

Happy Monday! I know Mondays can be rough, so I thought I'd send a quick note to start the week on a positive note.

Hope you have a productive and enjoyable week ahead. Let me know if there's anything I can help with.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Just wanted to say hi',
    body: `Hi {{firstName|there}},

No agenda here — just wanted to say hi and see how you're doing. Sometimes it's nice to hear from someone without there being a specific ask attached.

Hope everything's going well. Let me know if you ever want to grab a virtual coffee.

Talk soon,
{{senderFirstName}}`,
  },
  {
    subject: 'Hope your week is going well',
    body: `Hi {{firstName|there}},

Just a midweek check-in to say I hope your week is going well so far. I know things can get hectic, but I hope you're finding some moments to enjoy the process.

Looking forward to connecting soon. Take care of yourself.

Best regards,
{{senderFirstName}}`,
  },
  {
    subject: 'Long time no talk',
    body: `Hi {{firstName|there}},

I just realized it's been quite a while since we last connected. Time really flies! I've been meaning to reach out and see how everything is going.

Would love to catch up whenever your schedule allows. No pressure — just wanted to reestablish the connection.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: 'Hope all is well',
    body: `Hi {{firstName|there}},

Just dropping a quick note to say I hope all is well on your end. I've been thinking about some of the things we discussed and wanted to see how they turned out.

No need for a long reply — even a thumbs up would put my mind at ease.

Warmly,
{{senderFirstName}}`,
  },
  {
    subject: 'Random thought I wanted to share',
    body: `Hi {{firstName|there}},

This might seem a bit random, but I had a thought today that I felt like sharing with you. It relates to something we talked about a while back and I think you'd find it interesting.

Anyway, hope you're doing well. Let's catch up soon.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Checking in before the week ends',
    body: `Hi {{firstName|there}},

Wanted to check in before the week wraps up. It's been a busy one for me and I imagine the same for you. Just wanted to see how everything is going.

Hope you have a relaxing weekend ahead. Talk to you next week.

Take care,
{{senderFirstName}}`,
  },

  // ─── Introductions & Networking (5) ───────────────────────

  {
    subject: 'Great connecting with you',
    body: `Hi {{firstName|there}},

Really enjoyed meeting you and learning about what you're working on. I think there's a lot of overlap in our interests and it would be great to keep the conversation going.

Feel free to reach out anytime — I'm always happy to connect with like-minded professionals.

Best regards,
{{senderFirstName}}`,
  },
  {
    subject: 'Nice to meet you',
    body: `Hi {{firstName|there}},

It was great meeting you recently. I've been thinking about some of the things you mentioned and I'm really impressed by your work.

I'd love to stay in touch and explore ways we might be able to collaborate. Looking forward to future conversations.

Warm regards,
{{senderFirstName}}`,
  },
  {
    subject: 'Continuing our conversation',
    body: `Hi {{firstName|there}},

I really enjoyed our conversation and didn't want it to end there. There's clearly a lot we can learn from each other and I'd love to explore that further.

Would you be open to a follow-up chat sometime soon? I have a few ideas I'd love to bounce off you.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: 'Glad we connected',
    body: `Hi {{firstName|there}},

I'm really glad we had the chance to connect. It's always refreshing to meet someone who shares similar interests and brings such a thoughtful perspective.

Let's make sure to stay in touch. I have a feeling there are some great opportunities for us to collaborate.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Following up from our introduction',
    body: `Hi {{firstName|there}},

Wanted to follow up from our introduction and say how much I enjoyed learning about your background. You have a really impressive track record and I'd love to learn more.

Let me know if you'd be open to continuing the conversation. I'm confident it would be mutually beneficial.

Looking forward to it,
{{senderFirstName}}`,
  },

  // ─── Industry & News (5) ──────────────────────────────────

  {
    subject: 'Did you see the latest news?',
    body: `Hi {{firstName|there}},

Did you catch the latest industry news? I thought it was really interesting and immediately wanted to discuss it with someone who'd appreciate the implications.

Would love to hear your take on it when you have a moment. I think it could affect some of the things we've been working on.

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Interesting trend I noticed',
    body: `Hi {{firstName|there}},

I've been noticing an interesting trend lately and I think it's worth paying attention to. It's one of those things that could be a big deal if it continues to develop.

Have you noticed anything similar? I'd be curious to compare notes.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: 'Thoughts on recent developments?',
    body: `Hi {{firstName|there}},

I've been following some recent developments in our space and I'm curious about your perspective. There are some exciting changes happening and I think they could create new opportunities.

What's your take on where things are heading? Would love to hear your thoughts.

Best regards,
{{senderFirstName}}`,
  },
  {
    subject: 'The industry is changing fast',
    body: `Hi {{firstName|there}},

Have you noticed how quickly things are evolving in our industry? It seems like every week there's something new to adapt to. I find it exciting, but it definitely keeps you on your toes.

I'd love to swap perspectives on what you think the biggest changes will be over the next year.

Talk soon,
{{senderFirstName}}`,
  },
  {
    subject: 'Something noteworthy from this week',
    body: `Hi {{firstName|there}},

There was something noteworthy that caught my attention this week and I wanted to share it with you. It's the kind of thing that could have ripple effects across our field.

I'm still processing the implications, but my initial reaction is optimistic. What do you think?

Best,
{{senderFirstName}}`,
  },

  // ─── Collaboration Proposals (5) ──────────────────────────

  {
    subject: 'Potential collaboration idea',
    body: `Hi {{firstName|there}},

I've been thinking about potential ways we could collaborate and I have an idea I'd like to run by you. I think there's a natural synergy between what we're each working on.

It's still early-stage thinking, so I'd love to explore it together before committing to anything. What do you think?

Best,
{{senderFirstName}}`,
  },
  {
    subject: 'Let\'s work on something together',
    body: `Hi {{firstName|there}},

I've been brainstorming ideas and one of them involves your area of expertise. I think we could create something really valuable if we put our heads together.

No commitment needed — I just want to float the idea and see if it sparks your interest. Would you be open to a quick chat about it?

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: 'Partnership opportunity',
    body: `Hi {{firstName|there}},

I've identified an opportunity that I think could benefit both of us. It's the kind of thing that would be much better as a joint effort than going solo.

I'd love to share the details and get your honest feedback. Let me know if you'd be interested in hearing more.

Best regards,
{{senderFirstName}}`,
  },
  {
    subject: 'Could use a collaborator',
    body: `Hi {{firstName|there}},

I'm working on something that could really benefit from a collaborator with your skill set. I think it would be a fun project and potentially very rewarding for both of us.

If you're interested, I'd love to share more details. No pressure either way — just thought I'd ask.

Thanks,
{{senderFirstName}}`,
  },
  {
    subject: 'An idea I think you\'ll like',
    body: `Hi {{firstName|there}},

I had an idea recently that I think you'll find interesting. It combines a few things we've both talked about and I think it has real potential.

Would you have time this week for a quick call? I'd love to walk you through my thinking and hear your honest reaction.

Looking forward to it,
{{senderFirstName}}`,
  },
];

// ============================================================
// 50 REPLY TEMPLATES (initial replies to warmup emails)
// ============================================================

export const WARMUP_REPLY_TEMPLATES: WarmupTemplate[] = [
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks so much for reaching out! It's always great to hear from you. Everything is going well on my end — I've been keeping busy with a few exciting things.

I'd love to catch up properly soon. Let me know when works for you.

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Got your message — thanks for the update! Really appreciate you keeping me in the loop. Things are looking good from my perspective.

Let me know if there's anything you need from me. Happy to help however I can.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for checking in! I've been meaning to reach out as well, so your timing is perfect. I have a few updates of my own that I think you'll find interesting.

Let's definitely connect soon — lots to discuss.

Talk soon,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

I appreciate you thinking of me! Your message came at just the right time. I've been reflecting on some of the things we've discussed and I have some new thoughts to share.

How about we schedule a quick call this week?

Best regards,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Great to hear from you! Thanks for the kind words and for keeping this on your radar. Everything is progressing nicely and I'm feeling optimistic about what's ahead.

Let's touch base again soon. Looking forward to it.

Warm regards,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for reaching out! I was actually just thinking about our last conversation. There's been some good momentum lately and I'm excited about the direction things are headed.

Happy to discuss more whenever you're free.

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Really appreciate the message! It's great to stay connected like this. I've been busy but in the best possible way — lots of positive developments happening.

Would love to hear what's new on your end as well. Let me know when you have time.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for the update — that's really helpful! I've been working through a few things on my end too and I think we're both headed in a great direction.

Let me pull together my thoughts and I'll send you a more detailed response soon.

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Your message made my day! Thanks for being so thoughtful. It's always motivating to hear positive feedback and to know that others are thinking along the same lines.

I'll get back to you with some additional ideas shortly. Stay tuned.

Warmly,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks so much for following up! I'm glad you're keeping this conversation going — it's been really valuable. I have a few more thoughts to add and I think they'll complement what you've shared.

Let me put something together and I'll be in touch soon.

Best regards,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Good to hear from you! I've been heads down on a few things but I wanted to make sure I responded quickly. Your points are well taken and I agree with your overall direction.

Let's find time to dive deeper into this. What does your week look like?

Thanks,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for the thoughtful message. I always enjoy hearing your perspective — it helps me think more broadly about the things we're working on.

I'll review everything you mentioned and come back with my thoughts. Really appreciate the continued dialogue.

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Appreciate the quick note! Things are going well here — nothing major to report, but steady progress across the board. It's nice to have a moment to catch our breath.

Let me know if anything comes up that you'd like to discuss. Always happy to hop on a call.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for keeping me posted! It's really helpful to stay in sync like this. I've noticed some interesting parallels with what I've been working on and I think there's potential for some great synergy.

Let me organize my thoughts and we can compare notes soon.

Talk soon,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Great message — thanks for sharing! I've had some similar thoughts recently and it's reassuring to know we're thinking along the same lines.

I'd love to explore this further when you have time. No rush — just putting it on both our radars.

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for the heads up! I really value you keeping me in the loop on this. It gives me a chance to prepare and think through the implications ahead of time.

I'll follow up with any questions once I've had a chance to digest everything.

Much appreciated,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Wonderful to hear from you! I've been wanting to reconnect and your message gave me the perfect reason. Things are going really well and I have some exciting updates to share.

Let's schedule something soon — I think you'll be pleasantly surprised.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for reaching out — perfect timing as always! I just wrapped up a few things and have some bandwidth to dive into what you mentioned.

I'll take a closer look and get back to you with my thoughts by end of week.

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Really glad you sent this. I've been sitting on some thoughts and your message gave me the nudge to share them. I think you'll find them relevant to what you're working on.

Let me write them up properly and I'll send them over.

Thanks,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for the lovely note! It brightened my otherwise hectic day. I'm glad to hear things are going well for you — you deserve it.

Let's definitely catch up soon. I have a few stories to share that I think you'll enjoy.

Take care,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for circling back! I was planning to reach out this week anyway, so your message saved me the effort. Great minds think alike, right?

I'll gather my notes and follow up with a more detailed response. Looking forward to continuing this.

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Appreciate you taking the time to write! Your perspective is always refreshing and it's helpful to have someone who sees things a bit differently than I do.

I've bookmarked a few of your points to think on further. Let's discuss when we both have time.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for the message! I read through everything and I'm impressed — you've clearly been putting in the work. The progress you're making is really encouraging.

I have a few small suggestions that might help. I'll share them in our next conversation.

Best regards,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Got your email — thanks for looping me in! I think we're definitely on the right track with this. Your instincts have been spot on so far and I trust your judgment here.

Let me know if you need any input from my end. I'm here to help.

Talk soon,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thank you for the update! It's reassuring to know things are moving along smoothly. I know how much effort goes into making things look effortless, so kudos to you.

I'll keep an eye out for the next update. In the meantime, don't hesitate to reach out.

Warmly,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

This is great — thanks for sharing! I've been curious about how things were going and your message answered all my questions. Really happy with the direction.

Let's keep this momentum going. I'm available next week for a more in-depth chat if you're interested.

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for the kind message! It's always nice to start the day with positive news. I'm glad we're aligned on this — it makes everything so much smoother.

I'll reach out later this week with a few follow-up thoughts. Enjoy the rest of your day.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Really appreciate you checking in! It shows how much you care about this and that means a lot. Everything is on track and I'm confident we're heading in the right direction.

I'll flag anything that needs your attention. For now, smooth sailing.

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for the detailed message! I went through it carefully and I think your analysis is solid. There are a couple of areas where I'd like to add some color, but overall I'm fully on board.

Let me jot down my additions and I'll send them over soon.

Thanks,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Always a pleasure to hear from you! Your messages always come with some gem of insight that makes me think differently. This one was no exception.

I have some thoughts to share in return. Let's plan a time to swap ideas properly.

Best regards,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for the follow-up! You have great instincts about when to check in — this was exactly the right time. I was just starting to organize my thoughts on this topic.

Your timing gives us a nice opportunity to sync up. Let me know what works for you.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

I really enjoyed reading your message. You have a way of framing things that makes complex topics feel approachable. Thanks for making the effort to explain everything so clearly.

I have a few questions that I'll save for our next conversation. Talk soon!

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for the quick response! I wasn't expecting to hear back so fast, but I'm glad you're as excited about this as I am. Your enthusiasm is contagious.

Let me build on what you've shared and I'll come back with some concrete next steps.

Talk soon,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Appreciate the note! It's always good to stay connected, especially during busy periods. I've been heads down but your message is a welcome reminder to come up for air occasionally.

Let's plan to reconnect soon. I could use some of your good energy.

Warm regards,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for keeping this top of mind! I know we both have a lot going on, so the fact that you're staying on top of this means a lot. It's a testament to how much you care about doing things well.

I'll do my part and keep things moving forward. Let's check in again next week.

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Got it — thanks for confirming! That's exactly what I needed to know. Now I can move ahead with confidence and make sure everything is aligned on my end.

I'll send you a progress update once I've made some headway. Thanks again for the clarity.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thank you for the encouragement! Your words of support mean more than you might realize. It's been a demanding stretch and hearing from you was exactly the boost I needed.

I'll pass along the good vibes and keep pushing forward. Appreciate you.

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

I'm glad you reached out! I was starting to wonder how things were going and it's great to hear they're on track. Your consistency is really admirable.

Let me know if there's any way I can contribute further. I'm always happy to help out.

Thanks,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for sharing your thoughts! I've read through everything and I think we're very much on the same page. That's always a great place to start from.

I'll add my perspective and send it your way. Looking forward to seeing how our ideas come together.

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Really appreciate the thorough update! You clearly put a lot of thought into this and it shows. I'm impressed by the progress and excited about what comes next.

Happy to discuss any of these points in more detail. Just say the word.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for the message — it was exactly what I needed to hear today. Sometimes a well-timed email can completely shift your perspective, and yours did that for me.

I'll make sure to pay it forward. Thanks for being such a reliable connection.

Warmly,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

This is wonderful news — thanks for sharing! I can tell how much work went into getting to this point and it's great to see it paying off. You should be really proud.

Let's celebrate this progress. Coffee on me next time we connect.

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for following through on this. Reliability is such an underrated quality and you consistently demonstrate it. It makes working together a real pleasure.

I'll take a look at everything and come back with my feedback by tomorrow.

Best regards,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Glad to hear everything is going smoothly! That's the best kind of update to receive. It sounds like all the groundwork we laid is starting to pay dividends.

Keep up the excellent work. Let me know if anything changes or if you need support.

Talk soon,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for the prompt reply! I know how full your inbox must be, so I appreciate you making this a priority. It really helps to have people who are responsive and engaged.

I'll review your notes and follow up accordingly. Thanks for making this easy.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Love the energy in your message! It's clear you're excited about this and honestly, it's rubbing off on me. When both sides are this motivated, great things tend to happen.

Let's channel this momentum into action. I'll reach out with some ideas this week.

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for being so transparent. I really value honest communication and you always deliver. It makes it so much easier to plan and adjust when you know where things truly stand.

I'll factor this into my thinking and we can discuss next steps.

Thanks again,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Your message was a breath of fresh air. It's not every day you get such a well-considered update. I can see the thoughtfulness behind every point and it gives me confidence in the direction we're heading.

I'll do my homework and circle back with any additional input.

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Thanks for keeping me in the loop! I read through your update with interest and I'm really happy with how things are developing. Your attention to detail is impressive as always.

Let me know when you're ready for the next phase. I'm standing by.

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Hi {{firstName|there}},

Appreciate the follow-up — it's helpful to stay aligned. I've been working on a few related things on my end and I think our efforts are going to complement each other nicely.

I'll share my progress when I have a bit more to show. Thanks for your patience.

Best,
{{senderFirstName}}`,
  },
];

// ============================================================
// 30 CONTINUATION TEMPLATES (mid-thread replies)
// ============================================================

export const WARMUP_CONTINUATION_TEMPLATES: WarmupTemplate[] = [
  {
    subject: '',
    body: `That's great to hear, {{firstName|there}}! By the way, I had another thought about what we discussed — do you think there's room to expand on that idea?

I've been mulling it over and I see a few interesting possibilities. Let me know what you think.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Thanks for getting back to me, {{firstName|there}}! I'm curious — have you had a chance to explore any of the options we talked about? I'd love to hear where you landed.

No rush at all, just keeping the conversation going.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Good to know, {{firstName|there}}! Speaking of which, I wanted to circle back on one more thing. There's been a development on my end that I think you'd find relevant.

I'll compile the details and share them with you shortly.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `That makes a lot of sense, {{firstName|there}}. I appreciate you explaining it that way — it really helps clarify things. I have one more question that I think would round out my understanding.

Would you mind sharing your approach? I'd find it really valuable.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Perfect, {{firstName|there}} — I think we're on the same wavelength here. Is there anything else you need from my side before we move forward? I want to make sure I'm not holding anything up.

Let me know and I'll take care of it right away.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `I appreciate the clarification, {{firstName|there}}! That fills in a gap I had in my understanding. I'll make a note of it and adjust my thinking accordingly.

Thanks for always being so thorough. It makes everything easier.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Sounds good, {{firstName|there}}! I'll keep that in mind going forward. By the way, I ran into something interesting that relates to our discussion — I think you'd appreciate it.

I'll share the details next time we connect.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Really helpful context, {{firstName|there}}. This changes my perspective a bit, in a good way. I'm going to rethink my approach based on what you've shared.

Give me a day or two and I'll come back with an updated take. Thanks!

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Great point, {{firstName|there}}! I hadn't thought about it from that angle. This is exactly why I value these conversations — you always bring a fresh perspective.

I'm going to sit with this for a bit. I'll follow up once I've had time to think.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Absolutely, {{firstName|there}} — I agree completely. I think we've identified something really promising here. The next step would be to figure out the details.

I'll start putting together some thoughts and we can refine them together.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Noted, {{firstName|there}} — thank you! I'll make sure to incorporate that into my plan. Your feedback has been incredibly helpful throughout this whole process.

Let me know if anything else comes to mind. Always welcome.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `You make a compelling case, {{firstName|there}}. I've been going back and forth on this, but your reasoning is tipping the scales. I think you're right.

Let me align a few things on my end and I'll confirm the next steps.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `That's exactly what I was hoping to hear, {{firstName|there}}. It validates the direction I've been leaning and gives me the confidence to proceed.

I'll keep you posted on how things unfold. Thanks for the encouragement.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Interesting, {{firstName|there}} — I had a slightly different take but I can definitely see where you're coming from. Maybe the truth is somewhere in the middle.

Let's explore both angles when we have a chance to talk. Could be a productive discussion.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Thanks for following up on that, {{firstName|there}}. Your consistency with these conversations is something I really appreciate. It keeps everything moving smoothly.

I'll review what you've sent and come back with any questions. Talk soon.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Makes sense, {{firstName|there}} — I'm glad we're aligned. I was a little worried we might be approaching this differently, but it sounds like we're on the same page.

Let's keep this momentum going. I'll touch base again soon.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `I really value your honesty, {{firstName|there}}. It's so much better to have a straightforward conversation than to dance around things. Thanks for being direct.

I'll take your feedback to heart and make the necessary adjustments.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `You've given me a lot to think about, {{firstName|there}}. I'm going to take some time to process all of this and come back with a more thoughtful response.

Thanks for always pushing me to think deeper. It genuinely helps.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `That's a really smart observation, {{firstName|there}}. I wish I had thought of it sooner, but better late than never. I'm going to integrate this into my planning immediately.

Thanks for the insight — it's a game changer.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Good call, {{firstName|there}}. I think that's the right approach. It's practical, it's achievable, and it builds on what we already have. Sometimes simplicity is the best strategy.

I'm on board. Let me know how you'd like to proceed.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `I'm glad you brought that up, {{firstName|there}}. It's been on my mind too but I wasn't sure if it was worth raising. Turns out we're both thinking about the same things.

Let's tackle it head-on in our next conversation. It deserves attention.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `You're absolutely right, {{firstName|there}}. Looking at it from that perspective makes the path forward much clearer. I appreciate you taking the time to walk me through your reasoning.

I feel much more confident now. Thanks for your guidance.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Ha, {{firstName|there}} — great minds think alike! I was literally about to send you a message saying the same thing. It's reassuring to know we're in sync.

Let's keep riding this wave and see where it takes us.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `That clears things up nicely, {{firstName|there}}. I was a bit confused before but your explanation made everything click. Sometimes you just need the right person to explain it.

I'll proceed with the updated understanding. Thanks again.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `I love that idea, {{firstName|there}}! It's creative, it's bold, and I think it could really work. You've got great instincts for this kind of thing.

Let me think about how to put it into action and I'll share a rough plan.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Well said, {{firstName|there}}. You have a way of cutting through the noise and getting to the heart of the matter. That's a rare skill and I always appreciate it.

I'll take this and run with it. Expect an update from me soon.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Fair enough, {{firstName|there}} — I can see the logic behind that. Even though it's not what I initially expected, I think it's actually a better path forward.

Thanks for steering us in the right direction. Your judgment is solid.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `That's really encouraging, {{firstName|there}}. It's nice to get positive reinforcement, especially at this stage. Your support means a lot and keeps me motivated.

I'll push forward and share the results when I have them. Stay tuned.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `I see what you mean, {{firstName|there}} — it's subtle but important. I would have missed it if you hadn't pointed it out. Glad I have someone with your eye for detail in my corner.

I'll adjust my approach accordingly. Thanks for catching that.

{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Couldn't agree more, {{firstName|there}}. You've articulated exactly what I was feeling but couldn't quite put into words. Now that it's out in the open, I think we can address it properly.

Let's discuss the specifics in our next chat. I'll come prepared.

{{senderFirstName}}`,
  },
];

// ============================================================
// 20 CLOSER TEMPLATES (final thread replies)
// ============================================================

export const WARMUP_CLOSER_TEMPLATES: WarmupTemplate[] = [
  {
    subject: '',
    body: `This has been a really great conversation, {{firstName|there}}! I think we've covered a lot of ground and I'm feeling good about where things stand. Let's definitely do this again soon.

Have a wonderful rest of your week!

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Perfect, {{firstName|there}} — I think we're all set for now! Really appreciate your time and input throughout this discussion. It's been genuinely valuable.

Let's reconnect next week and pick up where we left off. Take care!

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Glad we could hash this out, {{firstName|there}}! I feel like we made real progress here. Thanks for being such a great thought partner.

Looking forward to our next conversation. Until then, take care of yourself!

Warm regards,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Thanks for the fantastic discussion, {{firstName|there}}! You always bring such thoughtful perspectives and it makes these conversations so worthwhile.

I'll follow up with the action items we identified. Talk to you soon!

Best regards,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `I think we wrapped this up nicely, {{firstName|there}}! Really appreciate how productive this exchange has been. It's always a pleasure working through ideas with you.

Have a great rest of your day. Until next time!

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Great chat, {{firstName|there}}! I'm feeling energized and optimistic about the path forward. Thanks for all the insightful feedback and for being so generous with your time.

I'll keep you posted on developments. Take care!

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `This was exactly the conversation I needed, {{firstName|there}}. Thanks for being so patient and thorough. I feel much clearer about everything now.

Let's touch base again soon. Wishing you a wonderful week ahead!

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Really enjoyed this exchange, {{firstName|there}}! It's not often you have a conversation that's both productive and genuinely enjoyable. Thanks for making it both.

I'll be in touch soon. Have a great one!

Warmly,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `I think we've come to a great conclusion here, {{firstName|there}}. Thanks for your persistence and attention to detail throughout this thread. It really paid off.

Looking forward to implementing what we discussed. Talk soon!

Best regards,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Wonderful conversation as always, {{firstName|there}}! I never leave one of our chats without learning something new. Thanks for always being so open and insightful.

Let's schedule another catch-up soon. Take care!

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Thanks for seeing this through, {{firstName|there}}! I know we went back and forth quite a bit, but I think the result was worth it. We've got a solid plan.

I'll get started on my end. Wishing you all the best!

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `That's a great note to end on, {{firstName|there}}! I'm feeling positive about everything we've discussed and I'm excited to see how things develop.

Thanks again for your time. Let's keep in touch!

Talk soon,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `I think we've covered everything, {{firstName|there}}. This has been one of the more productive email threads I've had in a while, and that's thanks to you.

I'll circle back when I have updates. In the meantime, enjoy the rest of your day!

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `What a great conversation this turned out to be, {{firstName|there}}! I appreciate you sticking with it and sharing your honest thoughts at every turn.

Here's to many more exchanges like this. Take care and talk soon!

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `I'm really glad we took the time for this, {{firstName|there}}. These kinds of conversations are what make working together so rewarding. Thank you for always bringing your best.

Until next time, take care!

Warm regards,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `Sounds like we have a solid plan, {{firstName|there}}! I'm confident in the direction we've set and I'm looking forward to seeing it come together.

Thanks for everything. Let's reconnect soon!

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `This has been great, {{firstName|there}}. I'm walking away from this thread feeling inspired and motivated. That's the mark of a truly great conversation.

I'll keep you in the loop. Have a fantastic rest of your week!

Cheers,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `All good things must come to an end, {{firstName|there}} — but I have a feeling this is just the beginning of something even better. Thanks for your partnership.

I'll follow up soon with next steps. Take care!

Best regards,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `I couldn't have asked for a better discussion partner, {{firstName|there}}. Your insights have been invaluable and I feel much better prepared moving forward.

Let's do this again soon. Wishing you all the best!

Best,
{{senderFirstName}}`,
  },
  {
    subject: '',
    body: `This was exactly the kind of productive exchange I was hoping for, {{firstName|there}}. Thank you for making it happen. I feel confident about the path ahead.

Talk to you soon. Have a great day!

Cheers,
{{senderFirstName}}`,
  },
];
