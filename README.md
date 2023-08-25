# Disclaimer

It should work just fine, I regularly use the script myself, but if anything wrong happens I am not taking any responsibility. Do not use this script if the 0.1% possible failure scares you.

# Prerequisites

I use Google Chrome. I don't know if it will work elsewhere. It probably will, but if it doesn't, just try on Chrome.

# Tutorial

- Go to https://twitter.com/
- Open the DevTools by pressing CTRL + SHIFT + I
- Click on Network tab in the DevTools console
  - If requests are not being recorded, press CTRL + E and wait 5 seconds
- You should now have something like this : ![ULXBFrT](https://github.com/teisseire117/DeleteTweets/assets/43145883/f784c575-efbb-42a2-a217-4700ba715b7e)
- Click on Fetch/XHR : ![KtZYL0L](https://github.com/teisseire117/DeleteTweets/assets/43145883/f0cdb3e8-f9ee-4ce3-ac39-c0a463c00bf6)
- Now click on any request in the results, and look for the authorization/X-Client-Transaction-Id/X-Client-Uuid values, as in screenshot: ![pxN8nth](https://github.com/teisseire117/DeleteTweets/assets/43145883/8f6b0123-2f51-41da-a234-255c5bbb5589)
- Now replace the values in the .js from this repository of the according variables, by the values of the three variables you found, here : ![hBH6SWy](https://github.com/teisseire117/DeleteTweets/assets/43145883/e985bc66-d028-4421-917e-1a118f8b3a31)

## Filtering
- You can filter which tweets to delete by editing the `delete_options` variable. For now you can decide to remove tweet that contain a certain keyword. For example if you want to delete tweets that contain the word "Hi" or "Hello"(case sensitive), change the variable to look like that :
```
var delete_options = {
	"delete_message_with_url_only":false,
	"match_any_keywords":["Hi", "Hello"]
}
```
- You can also choose to remove tweets only if they contain a link in them. Just change `delete_message_with_url_only` to `true`. You can combine this option with the keywords option.

Now copy/paste the script in the console, press Enter, and wait for the deletion to complete. It should write "DELETION COMPLETE" in the console when it's over.
When it's over, launch the script a second time, there sometime are a few leftovers.
