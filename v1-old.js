// Note: X may rate-limit deletions after approximately 200 tweets, with an observed cooldown of around 600 seconds (10 minutes). Both figures are estimates, not fixed API limits.
// Run from the X browser console while logged in. Deletes posts, replies and reposts.
// X changes its internal GraphQL requests; visit your Posts, Replies and Reposts tabs
// first so their current request parameters are available to this script.
(async () => {
  if (location.hostname !== 'x.com' && location.hostname !== 'twitter.com') throw Error('Open x.com first');
  const cookie = key => document.cookie.split('; ').find(x => x.startsWith(key + '='))?.slice(key.length + 1);
  const uid = decodeURIComponent(cookie('twid') || '').replace(/^u=/, '');
  if (!/^\d+$/.test(uid) || !cookie('ct0')) throw Error('Log in first; missing twid/ct0 cookie');
  const authorization = prompt('Paste the Authorization header from an X Network request (including Bearer):');
  if (!authorization?.startsWith('Bearer ')) throw Error('Valid Authorization header required');
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const operations = ['UserOriginalsTimeline', 'UserRepliesTimeline', 'UserRepostsTimeline'];
  const queryIds = {};
  const templates = {};
  for (const resource of performance.getEntriesByType('resource')) {
    const match = resource.name.match(/\/i\/api\/graphql\/([^/?]+)\/(UserOriginalsTimeline|UserRepliesTimeline|UserRepostsTimeline|DeleteTweet|DeleteRetweet)(?:\?|$)/);
    if (!match) continue;
    const [, id, operation] = match;
    queryIds[operation] = id;
    if (operations.includes(operation)) {
      const params = new URL(resource.name).searchParams;
      const parse = key => { try { return JSON.parse(params.get(key)); } catch { return undefined; } };
      templates[operation] = {
        variables: parse('variables'),
        features: parse('features'),
        fieldToggles: parse('fieldToggles')
      };
    }
  }
  for (const type of operations) {
    if (!queryIds[type] || !templates[type]?.variables || !templates[type]?.features) {
      throw Error('Missing '+type+' request. Visit the corresponding X profile tab, then rerun.');
    }
  }
  if (!queryIds.DeleteTweet || !queryIds.DeleteRetweet) {
    throw Error('Missing DeleteTweet/DeleteRetweet query IDs. Capture current requests in Network before rerunning.');
  }
  async function api(url, options = {}) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const response = await fetch(url, {
        credentials: 'include', cache: 'no-store', ...options,
        headers: {
          authorization, 'x-csrf-token': cookie('ct0'),
          'x-twitter-active-user': 'yes', 'x-twitter-auth-type': 'OAuth2Session',
          'x-twitter-client-language': navigator.language.split('-')[0],
          'content-type': 'application/json', ...(options.headers || {})
        }
      });
      if (response.status === 429) {
        const reset = Number(response.headers.get('x-rate-limit-reset'));
        const delay = reset > Date.now() / 1000 ? Math.max(60000, reset * 1000 - Date.now() + 2000) : 60000;
        console.warn('Rate limited; waiting '+Math.ceil(delay/1000)+' seconds');
        await wait(delay); continue;
      }
      if (!response.ok) throw Error('HTTP '+response.status+': '+(await response.text()).slice(0,400));
      const result = await response.json();
      if (result.errors?.length) throw Error(JSON.stringify(result.errors));
      return result;
    }
    throw Error('Rate limit did not clear');
  }
  async function firstPage(type) {
    const template = templates[type];
    const variables = { ...template.variables, userId: uid, count: 20 };
    delete variables.cursor;
    const params = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify(template.features)
    });
    if (template.fieldToggles) params.set('fieldToggles', JSON.stringify(template.fieldToggles));
    const result = await api(location.origin+'/i/api/graphql/'+queryIds[type]+'/'+type+'?'+params);
    const user = result?.data?.user?.result;
    const timeline = user?.timeline?.timeline || user?.timeline_v2?.timeline ||
      user?.timeline_inline_items?.timeline || user?.timeline;
    if (!Array.isArray(timeline?.instructions)) throw Error(type+': unexpected response structure');
    return timeline.instructions.flatMap(item => Array.isArray(item.entries) ? item.entries : item.entry ? [item.entry] : []);
  }
  function getBatch(entries, type) {
    const posts = new Map(), visited = new WeakSet();
    function scan(node) {
      if (!node || typeof node !== 'object' || visited.has(node)) return;
      visited.add(node);
      if (Array.isArray(node)) return node.forEach(scan);
      if (node.__typename === 'Tweet' || node.__typename === 'TweetWithVisibilityResults') {
        const tweet = node.__typename === 'TweetWithVisibilityResults' ? node.tweet : node;
        const author = tweet?.core?.user_results?.result;
        const authorId = tweet?.legacy?.user_id_str || tweet?.user_id_str || author?.rest_id || author?.legacy?.id_str;
        const id = tweet?.rest_id || tweet?.id_str || tweet?.legacy?.id_str;
        const source = tweet?.legacy?.retweeted_status_result?.result;
        const original = source?.rest_id || source?.tweet?.rest_id || tweet?.legacy?.retweeted_status_id_str;
        if (String(authorId) === uid && /^\d+$/.test(String(id))) {
          if (original) posts.set('DeleteRetweet:'+original, {operation:'DeleteRetweet', id:String(original)});
          else if (type !== 'UserRepostsTimeline') posts.set('DeleteTweet:'+id, {operation:'DeleteTweet',id:String(id)});
        }
      }
      Object.values(node).forEach(scan);
    }
    scan(entries);
    return [...posts.values()];
  }
  async function remove(post) {
    const queryId = queryIds[post.operation];
    const variables = post.operation === 'DeleteTweet'
      ? { tweet_id: post.id, dark_request: false }
      : { source_tweet_id: post.id };
    await api(location.origin+'/i/api/graphql/'+queryId+'/'+post.operation, {
      method:'POST', body:JSON.stringify({variables, queryId})
    });
  }
  let total = 0;
  const removed = new Set();
  for (const type of operations) {
    let stale = 0;
    while (true) {
      const batch = getBatch(await firstPage(type), type);
      const fresh = batch.filter(post => !removed.has(post.operation+':'+post.id));
      if (!batch.length) { console.log(type+': no more visible items'); break; }
      if (!fresh.length) {
        if (++stale >= 4) throw Error(type+': stale first page; stopped after '+total+' removals');
        await wait(5000); continue;
      }
      stale = 0;
      for (const post of fresh) {
        await remove(post);
        removed.add(post.operation+':'+post.id);
        console.log('Deleted '+(++total)+': '+post.operation+' '+post.id);
        await wait(1100);
      }
    }
  }
  console.log('Completed '+total+' deletion requests. Older timeline-hidden posts may remain.');
})().catch(error => console.error('Deletion stopped:', error));
