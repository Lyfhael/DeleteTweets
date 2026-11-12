// Run in the browser DevTools console at https://x.com/YOUR_USERNAME
// Deletes your own posts and replies, and undoes your reposts.
// Uses the X session already logged into this browser. No password needed.
(async () => {
  'use strict';

  const username = prompt('Enter your X username (without @):')?.trim().replace(/^@/, '');
  if (!username) throw Error('X username is required.');
  const authorization = prompt('Paste the authorization Bearer token from your own X browser session:')?.trim();
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) throw Error('A Bearer authorization value is required.');
  const DRY_RUN = false; // Set true to list actions without deleting anything.
  const WAIT_BETWEEN_DELETIONS_MS = 1300;
  const WAIT_BETWEEN_PAGES_MS = 650;
  const WAIT_AFTER_BATCH_MS = 2500;
  const STORAGE_KEY = `x-delete-progress:${username}:v3`;

  const ids = {
    UserOriginalsTimeline: 'z_JDHIa1yBS42jLdUH1j3A',
    UserRepliesTimeline: 'fTdkOgyI3EJPk0Qjlv8qUw',
    UserRepostsTimeline: '_ApdvtK9b54C7Q1LDtMxSA',
    DeleteTweet: 'nxpZCY2K-I6QoFHAHeojFQ',
    DeleteRetweet: 'ZyZigVsNiFO6v1dEks1eWg'
  };

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const getCookie = name => document.cookie.split('; ')
    .find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
  const uid = decodeURIComponent(getCookie('twid') || '').replace(/^u=/, '');
  if (location.hostname !== 'x.com' && location.hostname !== 'twitter.com') {
    throw Error('Open x.com first.');
  }
  if (!/^[0-9]+$/.test(uid) || !getCookie('ct0')) {
    throw Error('Log in to X first (twid/ct0 cookie missing).');
  }
  if (!location.pathname.toLowerCase().startsWith(`/${username.toLowerCase()}`)) {
    throw Error(`Open https://x.com/${username} before running this script.`);
  }
  if (!DRY_RUN && !confirm(`Permanently delete posts and replies, and undo ALL reposts, from @${username}?\n\nAuthenticated user ID: ${uid}\n\nThis cannot be undone.`)) {
    console.log('Cancelled.');
    return;
  }

  // Reuse query IDs and parameters that X itself loaded in this browser tab.
  const captured = {};
  for (const entry of performance.getEntriesByType('resource')) {
    const match = entry.name.match(/\/i\/api\/graphql\/([^/?]+)\/(UserOriginalsTimeline|UserRepliesTimeline|UserRepostsTimeline|DeleteTweet|DeleteRetweet)(?:\?|$)/);
    if (!match) continue;
    const [, id, name] = match;
    ids[name] = id;
    if (!name.endsWith('Timeline')) continue;
    const params = new URL(entry.name).searchParams;
    const parse = key => {
      try { return JSON.parse(params.get(key)); } catch { return undefined; }
    };
    captured[name] = {
      variables: parse('variables'),
      features: parse('features'),
      fieldToggles: parse('fieldToggles')
    };
  }

  const fallback = {
    variables: {
      userId: uid, count: 20, includePromotedContent: false,
      withVoice: true, withV2Timeline: true
    },
    features: {
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      responsive_web_enhance_cards_enabled: false
    },
    fieldToggles: { withArticlePlainText: false }
  };

  async function request(operation, url, options = {}) {
    for (let attempt = 1; attempt <= 20; attempt++) {
      const response = await fetch(url, {
        credentials: 'include',
        cache: 'no-store',
        referrer: `https://x.com/${username}`,
        ...options,
        headers: {
          authorization,
          'x-csrf-token': getCookie('ct0'),
          'x-twitter-active-user': 'yes',
          'x-twitter-auth-type': 'OAuth2Session',
          'x-twitter-client-language': navigator.language.split('-')[0],
          'content-type': 'application/json',
          ...(options.headers || {})
        }
      });
      if (response.status === 429) {
        const reset = Number(response.headers.get('x-rate-limit-reset'));
        const delay = reset > Date.now() / 1000
          ? Math.max(60000, reset * 1000 - Date.now() + 15000)
          : 600000; // 10 minutes if X provides no reset header.
        console.warn(`${operation}: rate limited. Sleeping ${Math.ceil(delay / 1000)} seconds (attempt ${attempt}/20).`);
        await sleep(delay);
        continue;
      }
      const body = await response.text();
      if (!response.ok) {
        throw Error(`${operation}: HTTP ${response.status}: ${body.slice(0, 300)}. Query IDs may have changed.`);
      }
      if (!body.trim()) throw Error(`${operation}: empty response, NOT counting as successful.`);
      let json;
      try { json = JSON.parse(body); }
      catch { throw Error(`${operation}: non-JSON response: ${body.slice(0, 200)}`); }
      if (json.errors?.length) throw Error(`${operation}: ${JSON.stringify(json.errors).slice(0, 350)}`);
      return json;
    }
    throw Error(`${operation}: rate limit still active; rerun later.`);
  }

  function timelineEntries(data) {
    const user = data?.data?.user?.result;
    const standard = user?.timeline?.timeline || user?.timeline_v2?.timeline ||
      user?.timeline_inline_items?.timeline || user?.timeline;
    let timeline = standard;
    if (!Array.isArray(timeline?.instructions)) {
      // Protect against a response wrapper changing its nesting depth.
      const queue = [data?.data];
      const visited = new WeakSet();
      for (let i = 0; i < queue.length && i < 300; i++) {
        const node = queue[i];
        if (!node || typeof node !== 'object' || visited.has(node)) continue;
        visited.add(node);
        if (Array.isArray(node.instructions)) { timeline = node; break; }
        for (const value of Object.values(node)) {
          if (value && typeof value === 'object') queue.push(value);
        }
      }
    }
    if (!Array.isArray(timeline?.instructions)) {
      throw Error('X changed its timeline response shape. Stopping rather than claiming there are no posts.');
    }
    return timeline.instructions.flatMap(instruction => [
      ...(Array.isArray(instruction.entries) ? instruction.entries : []),
      ...(instruction.entry ? [instruction.entry] : [])
    ]);
  }

  function unwrapTweet(input) {
    let tweet = input?.tweet_results?.result || input?.tweetResult?.result || input;
    for (let i = 0; i < 5; i++) {
      if (!tweet) return null;
      if (tweet.__typename === 'TweetWithVisibilityResults') { tweet = tweet.tweet; continue; }
      if (tweet.tweet && !tweet.rest_id && !tweet.legacy) { tweet = tweet.tweet; continue; }
      break;
    }
    return tweet?.rest_id || tweet?.legacy?.id_str ? tweet : null;
  }

  function authorIsMe(tweet) {
    const user = tweet?.core?.user_results?.result;
    const authorId = tweet?.legacy?.user_id_str || tweet?.user_id_str ||
      user?.rest_id || user?.legacy?.id_str;
    const screenName = user?.core?.screen_name || user?.legacy?.screen_name;
    return String(authorId || '') === uid ||
      (!authorId && String(screenName || '').toLowerCase() === username.toLowerCase());
  }

  function originalRepostId(tweet) {
    const wrapper = tweet?.legacy?.retweeted_status_result?.result;
    const original = unwrapTweet(wrapper);
    return original?.rest_id || tweet?.legacy?.retweeted_status_id_str ||
      tweet?.retweeted_status_id_str || tweet?.rest_id || null;
  }

  // Only look in timeline tweet items, not nested quoted posts or
  // other people's messages contained in a reply conversation.
  function postsInPage(entries, timelineType) {
    const found = new Map();
    let candidates = 0;
    for (const entry of entries) {
      const entryId = String(entry.entryId || '');
      const isConversation = entryId.startsWith('profile-conversation-');
      if (!entryId.startsWith('tweet-') && !isConversation) continue;
      if (isConversation && timelineType !== 'UserRepliesTimeline') continue;

      const contents = [];
      if (entry.content?.itemContent) contents.push(entry.content.itemContent);
      for (const moduleItem of entry.content?.items || []) {
        const content = moduleItem?.item?.itemContent || moduleItem?.itemContent;
        if (content) contents.push(content);
      }

      for (const content of contents) {
        if (content.promotedMetadata) continue;
        const tweet = unwrapTweet(content);
        if (!tweet) continue;
        candidates++;

        const own = authorIsMe(tweet);
        const wrapperSource = unwrapTweet(tweet?.legacy?.retweeted_status_result?.result);
        const isWrapper = Boolean(wrapperSource || tweet?.legacy?.retweeted_status_id_str);
        const id = String(tweet.rest_id || tweet.legacy?.id_str || '');
        if (!/^\d+$/.test(id)) continue;

        let operation, targetId;
        if (isWrapper && own) {
          // For a repost wrapper we authored, undo using the ORIGINAL id.
          operation = 'DeleteRetweet';
          targetId = String(originalRepostId(tweet));
        } else if (timelineType === 'UserRepostsTimeline') {
          // Reposts timeline can show the original author's tweet directly.
          operation = 'DeleteRetweet';
          targetId = isWrapper ? String(originalRepostId(tweet)) : id;
        } else if (own) {
          // Replies, original posts and quote posts are all our own tweets.
          operation = 'DeleteTweet';
          targetId = id;
        } else {
          continue; // Parent tweet from someone else in a reply thread.
        }
        if (/^\d+$/.test(targetId)) {
          found.set(`${operation}:${targetId}`, { operation, id: targetId });
        }
      }
    }
    if (candidates && !found.size) {
      console.warn(`${timelineType}: ${candidates} tweet objects, but no removable posts were identified.`);
    }
    return [...found.values()];
  }

  async function page(type, cursor) {
    const settings = captured[type] || {};
    const variables = { ...fallback.variables, ...(settings.variables || {}), userId: uid, count: 20 };
    delete variables.cursor;
    if (cursor) variables.cursor = cursor;
    const search = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify(settings.features || fallback.features),
      fieldToggles: JSON.stringify(settings.fieldToggles || fallback.fieldToggles)
    });
    const url = `https://x.com/i/api/graphql/${ids[type]}/${type}?${search}`;
    const data = await request(type, url, {
      referrer: `https://x.com/${username}${type === 'UserRepliesTimeline' ? '/with_replies' : type === 'UserRepostsTimeline' ? '/reposts' : ''}`
    });
    const profile = data?.data?.user?.result;
    const name = profile?.core?.screen_name || profile?.legacy?.screen_name;
    if (name && name.toLowerCase() !== username.toLowerCase()) {
      throw Error(`Logged-in account @${name} does not match @${username}.`);
    }
    return timelineEntries(data);
  }

  async function remove({ operation, id }) {
    const variables = operation === 'DeleteTweet'
      ? { tweet_id: id, dark_request: false }
      : { source_tweet_id: id };
    return request(operation, `https://x.com/i/api/graphql/${ids[operation]}/${operation}`, {
      method: 'POST',
      body: JSON.stringify({ variables, queryId: ids[operation] })
    });
  }

  function bottomCursor(entries) {
    const entry = [...entries].reverse().find(e =>
      e.content?.cursorType === 'Bottom' || String(e.entryId).startsWith('cursor-bottom')
    );
    return entry?.content?.value;
  }

  // Stream deletes instead of scanning all posts first.
  // Reset to the first page after each deleted batch because deleting posts
  // can invalidate/shift the cursors for subsequent pages.
  const completed = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  // Keep successful own-post deletions recorded by the previous version.
  // Re-check reposts because X can acknowledge an unrepost without removing it.
  const oldProgress = JSON.parse(localStorage.getItem(`x-delete-progress:${username}:v2`) || '[]');
  for (const key of oldProgress) {
    if (key.startsWith('DeleteTweet:')) completed.add(key);
  }
  const types = ['UserOriginalsTimeline', 'UserRepliesTimeline', 'UserRepostsTimeline'];
  let total = 0;

  for (const type of types) {
    let cursor;
    let pages = 0;
    let batches = 0;
    let timelineTotal = 0;
    const seenCursors = new Set();

    console.log(`Starting ${type}: fetching and deleting as posts are found...`);
    while (pages < 5000) {
      const entries = await page(type, cursor);
      pages++;
      const posts = postsInPage(entries, type);
      const fresh = posts.filter(post => !completed.has(`${post.operation}:${post.id}`));

      if (fresh.length) {
        console.log(`${type}: page ${pages}, removing ${fresh.length} now...`);
        for (const post of fresh) {
          if (!DRY_RUN) {
            await remove(post);
            completed.add(`${post.operation}:${post.id}`);
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed]));
          }
          total++;
          timelineTotal++;
          console.log(`${DRY_RUN ? 'Would remove' : 'Removed'} ${total}: ${post.operation} ${post.id}`);
          await sleep(WAIT_BETWEEN_DELETIONS_MS);
        }
        batches++;
        if (DRY_RUN) {
          // In dry-run, advance through pages instead of endlessly reading
          // the same first page, because nothing was actually deleted.
          const next = bottomCursor(entries);
          if (!next || seenCursors.has(next)) break;
          seenCursors.add(next);
          cursor = next;
        } else {
          // Immediately go back to the first page to avoid skipped posts.
          cursor = undefined;
          seenCursors.clear();
          await sleep(WAIT_AFTER_BATCH_MS);
        }
        continue;
      }

      // Empty/freshless pages may have only recently deleted cached tweets,
      // or parents from other authors. Follow the cursor to find more.
      const next = bottomCursor(entries);
      if (!next || seenCursors.has(next)) {
        console.log(`${type}: no more reachable new posts (pages ${pages}, removed ${timelineTotal}).`);
        break;
      }
      seenCursors.add(next);
      cursor = next;
      if (pages % 10 === 0) console.log(`${type}: checking older entries, page ${pages}...`);
      await sleep(WAIT_BETWEEN_PAGES_MS);
    }
    if (pages >= 5000) console.warn(`${type}: reached the 5000-page safety stop.`);
    console.log(`${type}: finished. ${timelineTotal} ${DRY_RUN ? 'candidates' : 'accepted removals'} in ${batches} batches.`);
  }

  console.log(`${DRY_RUN ? 'DRY RUN COMPLETE' : 'COMPLETE'}: ${total} ${DRY_RUN ? 'candidates' : 'accepted removals'}.`);
  console.log('X may still hide older posts from these timelines. An archive-based pass may be needed for full historical coverage.');
})().catch(error => console.error('Stopped:', error));