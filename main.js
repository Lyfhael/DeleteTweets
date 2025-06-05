var authorization =
	'Bearer ****'; // Replace *** by your Authentication Value, usually starts with a lot of AAAAAAAAAA's (It is screaming because of my bad code)
var client_tid =
	'****'; // Replace *** by X-Client-Transaction-Id value
var username = 'UsernameWithoutThe@'; // Replace 'Username' with your X.com Username (But WITHOUT the @ !!!)

// YOUR DELETION OPTIONS / FILTERS:
var delete_options = {
	// Do you want to import the Tweets from an X Archive?
	from_archive: false,

	// "true": Unretweets all your Retweets (respects other filters, so not *all* necessarily)
	// "false": Keeps all your retweets on your profile and won't unretweet/delete them.
	unretweet: false,

	// This option is so that you won't accidentally delete your pinned tweet. If you DO want to delete it, set this option to "false"
	do_not_remove_pinned_tweet: true,

	// If this is set to "true" ONLY Tweets containing Links will be deleted
	delete_message_with_url_only: false,

	// Better don't touch. Takes an Array and deletes exactly the Tweets with the IDs contained in it.
	// CAUTION: If set, ignores all other filteroptions!
	delete_specific_ids_only: [''],

	// Will only delete Tweets that have at least one of the keywords specified here. It is an array, so use it like this: ["badword1", "badword2", "badword3"]
	match_any_keywords: [''],

	// If you want to keep any tweets no matter what, get their IDs (The Number in the URL Bar when you clicked on it) and put them here. They won't be touched (i hope).
	tweets_to_ignore: ['00000000000000', '111111111111111', '222222222222'],

	// This option probably doesn't work as of May 2025, but if you try it and it fails please open an Issue in this Git project so I can debug it. I have no old tweets myself.
	old_tweets: false,

	// Only deletes Tweets AFTER/BEFORE the set date (excluding it)
	// CAUTION: Sometimes it uses your Timezone and sometimes it uses GMT. So better give a day of buffer and delete the rest yourself, if you don't want to risk losing any Tweets outside the date range.
	after_date: new Date('1900-01-01'),
	before_date: new Date('2100-01-01'),
};

/*
 * !!!  D O  N O T  T O U C H  A N Y T H I N G  A F T E R  T H I S  P O I N T  !!!
 * (Yes I use a lot more Semicolons, I am a PHP Dev, not a JS Dev. Bite me.)
 */

var ua = navigator.userAgentData.brands
	.map(brand => `"${brand.brand}";v="${brand.version}"`)
	.join(', ');
var csrf_token = getCookie('ct0');
var random_resource = 'HxuhRR6sXRbIzyv5f_94uQ'; // Updated resource ID because X changed this in April 2025
var random_resource_old_tweets = 'H8OOoI-5ZE4NxgRr8lfyWg'; // Probably not correct anymore as of April 2025
var language_code = navigator.language.split('-')[0];
var tweets_to_delete = [];
var user_id = getCookie('twid').substring(4);
var stop_signal = undefined;
var twitter_archive_content = undefined;
var twitter_archive_loading_confirmed = false;

function buildAcceptLanguageString() {
	const languages = navigator.languages;
	if (!languages || languages.length === 0) {
		return 'en-US,en;q=0.9';
	}
	let q = 1;
	const decrement = 0.1;
	return languages
		.map(lang => {
			if (q < 1) {
				const result = `${lang};q=${q.toFixed(1)}`;
				q -= decrement;
				return result;
			}
			q -= decrement;
			return lang;
		})
		.join(',');
}

function getCookie(name) {
	const value = `; ${document.cookie}`;
	const parts = value.split(`; ${name}=`);
	if (parts.length === 2) return parts.pop().split(';').shift();
}

async function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetch_tweets(cursor, retry = 0) {
	let count = '20';
	let final_cursor = cursor ? `%22cursor%22%3A%22${cursor}%22%2C` : '';
	let resource = delete_options['old_tweets']
		? random_resource_old_tweets
		: random_resource;
	let endpoint = delete_options['old_tweets']
		? 'UserTweets'
		: 'UserTweetsAndReplies';
	var base_url = `https://x.com/i/api/graphql/${resource}/${endpoint}`;

	var variable = '';
	var feature = '';
	if (delete_options['old_tweets'] == false) {
		// Variable & Feature Parameters got changed in April 2025. We have to include a lot more of them now.
		variable = `?variables=%7B%22userId%22%3A%22${user_id}%22%2C%22count%22%3A${count}%2C${final_cursor}%22includePromotedContent%22%3Atrue%2C%22withCommunity%22%3Atrue%2C%22withVoice%22%3Atrue%7D`;
		feature = `&features=%7B%22rweb_video_screen_enabled%22%3Afalse%2C%22profile_label_improvements_pcf_label_in_post_enabled%22%3Atrue%2C%22rweb_tipjar_consumption_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22premium_content_api_read_enabled%22%3Afalse%2C%22communities_web_enable_tweet_community_results_fetch%22%3Atrue%2C%22c9s_tweet_anatomy_moderator_badge_enabled%22%3Atrue%2C%22responsive_web_grok_analyze_button_fetch_trends_enabled%22%3Afalse%2C%22responsive_web_grok_analyze_post_followups_enabled%22%3Atrue%2C%22responsive_web_jetfuel_frame%22%3Afalse%2C%22responsive_web_grok_share_attachment_enabled%22%3Atrue%2C%22articles_preview_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Atrue%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22responsive_web_grok_show_grok_translated_post%22%3Afalse%2C%22responsive_web_grok_analysis_button_from_backend%22%3Afalse%2C%22creator_subscriptions_quote_tweet_preview_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_grok_image_annotation_enabled%22%3Atrue%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D&fieldToggles=%7B%22withArticlePlainText%22%3Afalse%7D`;
	} else {
		variable = `?variables=%7B%22userId%22%3A%22${user_id}%22%2C%22count%22%3A${count}%2C${final_cursor}%22includePromotedContent%22%3Atrue%2C%22withQuickPromoteEligibilityTweetFields%22%3Atrue%2C%22withVoice%22%3Atrue%2C%22withV2Timeline%22%3Atrue%7D`;
		feature = `&features=%7B%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Afalse%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_media_download_video_enabled%22%3Afalse%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D`;
	}

	var final_url = `${base_url}${variable}${feature}`;

	const response = await fetch(final_url, {
		headers: {
			accept: '*/*',
			'accept-language': buildAcceptLanguageString(),
			authorization: authorization,
			'content-type': 'application/json',
			'sec-ch-ua': ua,
			'sec-ch-ua-mobile': '?0',
			'sec-ch-ua-platform': '"Linux"', // Changed it to Linux because it worked better for me (I am on Linux though). Maybe we have to detect it or make it an Option in the Future?
			'sec-fetch-dest': 'empty',
			'sec-fetch-mode': 'cors',
			'sec-fetch-site': 'same-origin',
			'x-client-transaction-id': client_tid,
			'x-csrf-token': csrf_token,
			'x-twitter-active-user': 'yes',
			'x-twitter-auth-type': 'OAuth2Session',
			'x-twitter-client-language': language_code,
		},
		referrer: `https://x.com/${username}/with_replies`,
		referrerPolicy: 'strict-origin-when-cross-origin',
		body: null,
		method: 'GET',
		mode: 'cors',
		credentials: 'include',
	});

	if (!response.ok) {
		if (response.status === 429) {
			console.log('Rate limit reached. Waiting 1 minute');
			await sleep(1000 * 60);
			return fetch_tweets(cursor, retry + 1);
		}
		if (retry == 5) {
			throw new Error('Max retries reached');
		}
		console.log(
			`(fetch_tweets) Network response was not ok, status: ${response.status
			}, retrying in ${10 * (1 + retry)} seconds`
		);
		console.log(await response.text());
		await sleep(10000 * (1 + retry));
		return fetch_tweets(cursor, retry + 1);
	}

	const data = await response.json();
	console.log('API Response:', JSON.stringify(data, null, 2)); // Log the full response for debugging

	// Safely access the instructions array, the method got more complicated too thanks to the recent changes. The Responses are not uniform anymore, so we have to cover all possibilities.
	let instructions = null;
	if (data?.data?.user?.result?.timeline?.timeline?.instructions) {
		instructions = data.data.user.result.timeline.timeline.instructions;
	} else if (data?.data?.user?.result?.timeline_v2?.timeline?.instructions) {
		instructions = data.data.user.result.timeline_v2.timeline.instructions;
	} else {
		console.error('Unexpected API response structure:', data);
		// Error if response is not in the expected format
		throw new Error(
			'Unable to find timeline instructions in API response. Check the logged API response for details.'
		);
	}

	let entries = instructions;
	for (let item of entries) {
		if (item['type'] === 'TimelineAddEntries') {
			entries = item['entries'];
			break;
		}
	}
	if (!entries || entries.length === 0) {
		// Added Error for no Tweets found
		console.log(
			'No entries found in TimelineAddEntries. This might be expected if the user has no tweets.'
		);
		return [];
	}
	console.log('Entries:', entries);
	return entries;
}

async function log_tweets(entries) {
	if (!entries || entries.length === 0) {
		console.log('No entries to process in log_tweets.');
		return 'finished';
	}
	for (let item of entries) {
		if (
			item['entryId'].startsWith('profile-conversation') ||
			item['entryId'].startsWith('tweet-')
		) {
			findTweetIds(item);
		} else if (
			item['entryId'].startsWith('cursor-bottom') &&
			entries.length > 2
		) {
			let cursor_bottom = item['content']['value'];
			return cursor_bottom;
		}
	}
	return 'finished';
}

function check_keywords(text) {
	if (delete_options['match_any_keywords'].length == 0) {
		return true;
	}
	for (let word of delete_options['match_any_keywords']) {
		if (text.includes(word)) {
			return true;
		}
	}
	return false;
}

function check_date(tweet) {
	if (tweet['legacy'].hasOwnProperty('created_at')) {
		let tweet_date = new Date(tweet['legacy']['created_at']);
		tweet_date.setHours(0, 0, 0, 0);
		if (
			tweet_date > delete_options['after_date'] &&
			tweet_date < delete_options['before_date']
		) {
			return true;
		} else if (tweet_date < delete_options['after_date']) {
			stop_signal = true;
		}
		return false;
	}
	return true;
}

function check_date_archive(created_at) {
	let tweet_date = new Date(created_at);
	tweet_date.setHours(0, 0, 0, 0);
	if (
		tweet_date > delete_options['after_date'] &&
		tweet_date < delete_options['before_date']
	) {
		return true;
	} else if (tweet_date < delete_options['after_date']) {
		stop_signal = true;
	}
	return false;
}

function check_filter(tweet) {
	// Clarified
	if (
		tweet['legacy'].hasOwnProperty('id_str') &&
		(delete_options['tweets_to_ignore'].includes(tweet['legacy']['id_str']) ||
			delete_options['tweets_to_ignore'].includes(
				parseInt(tweet['legacy']['id_str'])
			))
	) {
		return false;
	}
	if (delete_options['delete_message_with_url_only'] == true) {
		if (
			tweet['legacy'].hasOwnProperty('entities') &&
			tweet['legacy']['entities'].hasOwnProperty('urls') &&
			tweet['legacy']['entities']['urls'].length > 0 &&
			check_keywords(tweet['legacy']['full_text']) &&
			check_date(tweet)
		) {
			return true;
		}
		return false;
	}
	if (check_keywords(tweet['legacy']['full_text']) && check_date(tweet)) {
		return true;
	}
	return false;
}

function check_filter_archive(tweet_obj) {
	let tweet_id = tweet_obj['id'];
	let tweet_str = tweet_obj['text'];
	let tweet_date = tweet_obj['date'];
	if (
		delete_options['tweets_to_ignore'].includes(tweet_id) ||
		delete_options['tweets_to_ignore'].includes(parseInt(tweet_id))
	) {
		return false;
	}
	if (check_keywords(tweet_str) && check_date_archive(tweet_date)) {
		return true;
	}
	return false;
}

function check_tweet_owner(obj, uid) {
	if (
		obj.hasOwnProperty('legacy') &&
		obj['legacy'].hasOwnProperty('retweeted') &&
		obj['legacy']['retweeted'] === true &&
		delete_options['unretweet'] == false
	) {
		return false;
	}
	if (obj.hasOwnProperty('user_id_str') && obj['user_id_str'] === uid) {
		return true;
	} else if (
		obj.hasOwnProperty('legacy') &&
		obj['legacy'].hasOwnProperty('user_id_str') &&
		obj['legacy']['user_id_str'] === uid
	) {
		return true;
	}
	return false;
}

function tweetFound(obj) {
	console.log(`Found tweet: ${obj['legacy']['full_text']}`);
}

function parseTweetsFromArchive(data) {
	try {
		const filteredIds = [];
		data.forEach(item => {
			if (item.tweet && item.tweet.id_str) {
				const isInReplyToExcludedUser =
					item.tweet.in_reply_to_user_id_str === user_id;
				const startsWithRT = item.tweet.full_text.startsWith('RT ');
				let tweet_obj = {};
				tweet_obj['id'] = item.tweet.id_str;
				tweet_obj['text'] = item.tweet.full_text;
				tweet_obj['date'] = item.tweet.created_at;
				if (
					!isInReplyToExcludedUser &&
					((delete_options['unretweet'] == true && startsWithRT == true) ||
						(delete_options['unretweet'] == false && startsWithRT == false)) &&
					check_filter_archive(tweet_obj)
				) {
					console.log('DELETING:', item.tweet.full_text);
					filteredIds.push(item.tweet.id_str);
				}
			}
		});
		return filteredIds;
	} catch (error) {
		console.error('Error parsing JSON:', error);
		return [];
	}
}

function findTweetIds(obj) {
	function recurse(currentObj) {
		if (
			typeof currentObj !== 'object' ||
			currentObj === null ||
			(delete_options['do_not_remove_pinned_tweet'] == true &&
				currentObj['__type'] == 'TimelinePinEntry')
		) {
			return;
		}
		if (
			currentObj['__typename'] === 'TweetWithVisibilityResults' &&
			currentObj.hasOwnProperty('tweet') &&
			check_tweet_owner(currentObj['tweet'], user_id) &&
			check_filter(currentObj['tweet'])
		) {
			tweets_to_delete.push(
				currentObj['tweet']['id_str'] || currentObj['tweet']['legacy']['id_str']
			);
			tweetFound(currentObj['tweet']);
		} else if (
			currentObj.hasOwnProperty('__typename') &&
			currentObj['__typename'] === 'Tweet' &&
			check_tweet_owner(currentObj, user_id) &&
			check_filter(currentObj)
		) {
			tweets_to_delete.push(
				currentObj['id_str'] || currentObj['legacy']['id_str']
			);
			tweetFound(currentObj);
		}
		for (let key in currentObj) {
			if (currentObj.hasOwnProperty(key)) {
				recurse(currentObj[key]);
			}
		}
	}
	recurse(obj);
}

async function delete_tweets(id_list) {
	var delete_tid =
		'LuSa1GYxAMxWEugf+FtQ/wjCAUkipMAU3jpjkil3ujj7oq6munDCtNaMaFmZ8bcm7CaNvi4GIXj32jp7q32nZU8zc5CyLw';
	var id_list_size = id_list.length;
	var retry = 0;
	for (let i = 0; i < id_list_size; ++i) {
		const response = await fetch(
			'https://x.com/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet',
			{
				headers: {
					accept: '*/*',
					'accept-language': buildAcceptLanguageString(),
					authorization: authorization,
					'content-type': 'application/json',
					'sec-ch-ua': ua,
					'sec-ch-ua-mobile': '?0',
					'sec-ch-ua-platform': '"Linux"', // Linux again
					'sec-fetch-dest': 'empty',
					'sec-fetch-mode': 'cors',
					'sec-fetch-site': 'same-origin',
					'x-client-transaction-id': delete_tid,
					'x-csrf-token': csrf_token,
					'x-twitter-active-user': 'yes',
					'x-twitter-auth-type': 'OAuth2Session',
					'x-twitter-client-language': language_code,
				},
				referrer: `https://x.com/${username}/with_replies`,
				referrerPolicy: 'strict-origin-when-cross-origin',
				body: `{\"variables\":{\"tweet_id\":\"${id_list[i]}\",\"dark_request\":false},\"queryId\":\"VaenaVgh5q5ih7kvyVjgtg\"}`,
				method: 'POST',
				mode: 'cors',
				credentials: 'include',
			}
		);
		if (!response.ok) {
			if (response.status === 429) {
				// Clarified Error-Message for Debugging
				console.log('Rate limit reached in delete_tweets. Waiting 1 minute');
				await sleep(1000 * 60);
				i -= 1;
				continue;
			}
			if (retry == 8) {
				// Clarified Error-Message for Debugging
				throw new Error('Max retries reached in delete_tweets');
			}
			console.log(await response.text());
			// Clarified Error-Message for Debugging
			console.log(
				`(delete_tweets) Network response was not ok, status: ${response.status
				}, retrying in ${10 * (1 + retry)} seconds`
			);
			i -= 1;
			await sleep(10000 * (1 + retry));
			retry++;
			continue;
		}
		retry = 0;
		console.log(`Deleted tweet ${i + 1}/${id_list_size}`);
		await sleep(100);
	}
}

var next = null;
var entries = undefined;

if (delete_options['from_archive'] == true) {
	console.log('Waiting for user to load his Twitter archive');
	const modal = document.createElement('div');
	modal.id = 'myModal';
	modal.className = 'modal';
	const modalContent = document.createElement('div');
	modalContent.className = 'modal-content';
	const closeSpan = document.createElement('span');
	closeSpan.className = 'close';
	closeSpan.innerHTML = '×';
	const header = document.createElement('h2');
	header.innerText = 'Drop Your File Here';
	const dropArea = document.createElement('div');
	dropArea.id = 'drop-area';
	dropArea.className = 'drop-area';
	dropArea.innerHTML =
		'<p>Drop your tweets.js from your Twitter Archive here</p>';
	modalContent.appendChild(closeSpan);
	modalContent.appendChild(header);
	modalContent.appendChild(dropArea);
	modal.appendChild(modalContent);
	document.body.appendChild(modal);
	const styles = `
        .modal {
            display: none;
            position: fixed;
            z-index: 1;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            background-color: rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .modal-content {
            background-color: #fff;
            margin: auto;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            width: 400px;
            text-align: center;
        }
        .close {
            color: #aaa;
            position: absolute;
            top: 10px;
            right: 20px;
            font-size: 24px;
            font-weight: bold;
            cursor: pointer;
        }
        .close:hover {
            color: black;
        }
        .drop-area {
            border: 2px dashed #007bff;
            border-radius: 5px;
            padding: 60px;
            cursor: pointer;
            transition: .5s ease-in-out;
        }
        .drop-area:hover {
            border-color: #0056b3;
            background-color: #dff3fb;
            transition: .5s ease-in-out;
        }
        .drop-area.active {
            background-color: #f3f4f6;
            border-color: #4caf50;
            color: #4caf50;
        }
        .drop-area.active p {
            font-weight: bold;
            color: #4caf50;
        }
        h2 {
            color: #333;
            margin-bottom: 20px;
        }
        p {
            margin: 0;
            color: #666;
        }
        .confirm-button {
            margin-top: 30px;
            background-color: rgb(0, 116, 212);
            border: 2px solid rgb(0, 116, 212);
            border-radius: 3px;
        }
    `;
	const styleSheet = document.createElement('style');
	styleSheet.type = 'text/css';
	styleSheet.innerText = styles;
	document.head.appendChild(styleSheet);
	modal.style.display = 'flex';
	closeSpan.onclick = function () {
		modal.style.display = 'none';
	};
	window.onclick = function (event) {
		if (event.target === modal) {
			modal.style.display = 'none';
		}
	};
	const confirmButton = document.createElement('button');
	confirmButton.innerText = 'Confirm';
	confirmButton.className = 'confirm-button';
	confirmButton.style.marginTop = '5px';
	modalContent.appendChild(confirmButton);
	confirmButton.addEventListener('click', () => {
		if (twitter_archive_content) {
			console.log('Confirmation received. File processed.');
			twitter_archive_loading_confirmed = true;
			modal.style.display = 'none';
		} else {
			console.error('No file loaded. Please load a file before confirming.');
		}
	});
	dropArea.addEventListener('dragover', event => {
		event.stopPropagation();
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
		dropArea.classList.add('active');
	});
	dropArea.addEventListener('dragleave', event => {
		dropArea.classList.remove('active');
	});
	dropArea.addEventListener('drop', event => {
		event.stopPropagation();
		event.preventDefault();
		dropArea.classList.remove('active');
		const file = event.dataTransfer.files[0];
		readFile(file);
	});
	dropArea.onclick = function () {
		const fileInput = document.createElement('input');
		fileInput.type = 'file';
		fileInput.onchange = e => {
			const file = e.target.files[0];
			readFile(file);
		};
		fileInput.click();
	};
	function readFile(file) {
		const reader = new FileReader();
		reader.onload = function (event) {
			const content = event.target.result;
			const parts = content.split('=');
			parts.shift();
			const jsonPart = parts.join('=').trim();
			try {
				const data = JSON.parse(jsonPart);
				twitter_archive_content = data;
				console.log('JSON data loaded into global variable.');
			} catch (e) {
				console.error('Error parsing JSON:', e);
			}
		};
		reader.onerror = function (error) {
			console.error('Error reading file:', error);
		};
		reader.readAsText(file);
	}
}

if (delete_options['from_archive'] == true) {
	while (twitter_archive_loading_confirmed == false) {
		await sleep(1000);
	}
	tweets_to_delete = parseTweetsFromArchive(twitter_archive_content);
	// Better Debugging
	console.log('Tweets to delete from archive:', tweets_to_delete);
	await delete_tweets(tweets_to_delete);
} else if (
	delete_options['delete_specific_ids_only'].length == 1 &&
	delete_options['delete_specific_ids_only'][0].length == 0
) {
	while (next != 'finished' && stop_signal != true) {
		entries = await fetch_tweets(next);
		next = await log_tweets(entries);
		console.log('Tweets to delete in this batch:', tweets_to_delete);
		if (tweets_to_delete.length > 0) {
			await delete_tweets(tweets_to_delete);
			tweets_to_delete = [];
		}
		await sleep(3000);
	}
} else {
	// Better Debugging
	console.log(
		'Deleting specific tweet IDs:',
		delete_options['delete_specific_ids_only']
	);
	await delete_tweets(delete_options['delete_specific_ids_only']);
}

console.log(
	'DELETION COMPLETE (if no errors were logged above, all selected tweets should be deleted)'
);
