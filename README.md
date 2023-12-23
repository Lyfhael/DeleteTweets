# Disclaimer

It should work just fine, I regularly use the script myself, but if anything wrong happens I am not taking any responsibility. Do not use this script if the 0.1% possible failure scares you.

# Prerequisites

I use Google Chrome. I don't know if it will work elsewhere. It probably will, but if it doesn't, just try on Chrome.

# Tutorial

(if you can't find  the uuid, put any value it'll work)

##  Video Tutorial
https://github.com/teisseire117/DeleteTweets/assets/43145883/249584c3-ce01-424b-8ce5-751e976c8df0



## Text Tutorial

- Go to https://twitter.com/
- Open the DevTools by pressing CTRL + SHIFT + I
- Click on Network tab in the DevTools console
  - If requests are not being recorded, press CTRL + E and wait 5 seconds
- You should now have something like this : ![ULXBFrT](https://github.com/teisseire117/DeleteTweets/assets/43145883/f784c575-efbb-42a2-a217-4700ba715b7e)
- Click on Fetch/XHR : ![KtZYL0L](https://github.com/teisseire117/DeleteTweets/assets/43145883/f0cdb3e8-f9ee-4ce3-ac39-c0a463c00bf6)
- Now click on any request in the results, and look for the authorization/X-Client-Transaction-Id/X-Client-Uuid values, as in screenshot: ![pxN8nth](https://github.com/teisseire117/DeleteTweets/assets/43145883/8f6b0123-2f51-41da-a234-255c5bbb5589)
- Now replace the values in the .js from this repository of the according variables, by the values of the three variables you found, here is an example of how it should look in the end : ![E0M6Bf9](https://github.com/teisseire117/DeleteTweets/assets/43145883/bac5806b-9c76-4018-b2c0-55fb9080e715)

## Filtering / Options
- You can now choose to delete only tweets that are within a specific date range. For this, edit "before_date" and "after_date" in the `delete_options` variable. These will look like that :
```
	"after_date":new Date('1900-01-01'), // year-month-day
	"before_date":new Date('2100-01-01') // year-month-day
```
Say you want to delete tweets that happened on July 3rd 2023. You would set the date to that :
```
	"after_date":new Date('2023-07-02'), // year-month-day
	"before_date":new Date('2023-07-04') // year-month-day
```
It means : Delete tweet AFTER July 2nd 2023, and BEFORE July 4th 2023. These two dates are not included, so it's only what's in-between these dates, and what's before 2nd and 4th, you got it, 3rd.
NOTE: This is not optimized at all. Meaning the script will go through ALL of your tweets no matter what date you gave. It will only delete tweets that are in the date range you gave, but it will go through all tweets. I will try to optimize it later.

- You can filter which tweets to delete by editing the `delete_options` variable. For now you can decide to remove tweet that contain a certain keyword. For example if you want to delete tweets that contain the word "Hi" or "Hello"(case sensitive), change the variable to look like that :
```
var delete_options = {
	"delete_message_with_url_only":false,
	"match_any_keywords":["Hi", "Hello"]
}
```
- You can also choose to remove tweets only if they contain a link in them. Just change `delete_message_with_url_only` to `true`. You can combine this option with the keywords option.
- Edit 25/08/2023, you can now add tweet ids that you want to keep, so they won't get removed. It's the "tweets_to_ignore" property in the delete_options variable. Just add the tweet id in the array
- Edit 29/08/2023, you can now choose to also unretweet or not, by changing the "unretweet" property in the delete_options variable. Set it to true if you want to unretweet. It combines with the other filters.
- Edit 10/09/2023, IF the script removed some tweets but not all, AND that there were no error thrown, then you can set the option "old_tweets":false to true in the delete_options object. Then launch the script again, and it should delete these older tweets.
- Edit 06/10/2023, new delete_options : do_not_remove_pinned_tweet, it is set to true by default so you don't remove your pinned tweet by mistake.
- Edit 07/10/2023, added "delete_specific_ids_only" option. Override the default tweet search, and only remove tweets from their IDs that you have put in this option(it's an array)
- Edit 07/12/2023, added from_archive option. It's WAY faster, no rate-limit, and it's more complete. Download your archive from Twitter then enable from_archive by setting it to true in the script, then you'll see a box asking you to drag your tweets.js file in it.

Now copy/paste the script in the console, press Enter, and wait for the deletion to complete. It should write "DELETION COMPLETE" in the console when it's over.
When it's over, launch the script a second time, there sometime are a few leftovers.

# Support

I allow tickets in French 🇫🇷 but prefer English if you can speak it, so everyone can understand.


# FAQ

## Do I need to include the Bearer part of the authorization key ?
Yes

## I can't find X-Client-Transaction-Id/X-Client-Uuid/authorization
In the request list, search for requests named `client_event.json`, they are the more frequent ones, and they always contain the tokens you need

## Uncaught TypeError: entries is not iterable

If you have this error, in the script edit the random_resource variable from
`var random_resource = "uYU5M2i12UhDvDTzN6hZPg";`
to
`var random_resource = "Q6aAvPw7azXZbqXzuqTALA";`

Then go to the fetch_tweets() function and change the feature variable to:
```
var feature = `&features=%7B%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Afalse%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_media_download_video_enabled%22%3Afalse%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D"`
```

And it should work :) Also I updated the script on 5/09/2023 so if you got the script before that date, it's most likely outdated and you need to get the new one.

# Other

https://ko-fi.com/lolarchiver# if you feel like it :D
