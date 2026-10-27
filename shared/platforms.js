// Social platforms available for profile links.
// icon: "si:<slug>" is a Simple Icons brand glyph, "lu:<name>" is a Lucide outline icon.
// url: template where {v} is replaced with the handle. copy: clicking copies the value
// instead of opening a link (used for things like Discord usernames or wallet addresses).

export const PLATFORM_GROUPS = ['Social', 'Gaming', 'Music & Video', 'Dev', 'Creators & Money', 'Crypto', 'Contact', 'Other'];

export const PLATFORMS = [
  // Social
  { id: 'discord', name: 'Discord', group: 'Social', icon: 'si:discord', color: '#5865F2', copy: true, idUrl: 'https://discord.com/users/{v}', ph: 'username, user ID or invite link' },
  { id: 'x', name: 'X / Twitter', group: 'Social', icon: 'si:x', color: '#ffffff', url: 'https://x.com/{v}', ph: 'handle' },
  { id: 'instagram', name: 'Instagram', group: 'Social', icon: 'si:instagram', color: '#E4405F', url: 'https://instagram.com/{v}', ph: 'handle' },
  { id: 'tiktok', name: 'TikTok', group: 'Social', icon: 'si:tiktok', color: '#ffffff', url: 'https://tiktok.com/@{v}', ph: 'handle' },
  { id: 'snapchat', name: 'Snapchat', group: 'Social', icon: 'si:snapchat', color: '#FFFC00', url: 'https://snapchat.com/add/{v}', ph: 'username' },
  { id: 'reddit', name: 'Reddit', group: 'Social', icon: 'si:reddit', color: '#FF4500', url: 'https://reddit.com/u/{v}', ph: 'username' },
  { id: 'threads', name: 'Threads', group: 'Social', icon: 'si:threads', color: '#ffffff', url: 'https://threads.net/@{v}', ph: 'handle' },
  { id: 'bluesky', name: 'Bluesky', group: 'Social', icon: 'si:bluesky', color: '#0285FF', url: 'https://bsky.app/profile/{v}', ph: 'handle.bsky.social' },
  { id: 'mastodon', name: 'Mastodon', group: 'Social', icon: 'si:mastodon', color: '#6364FF', ph: 'profile URL' },
  { id: 'facebook', name: 'Facebook', group: 'Social', icon: 'si:facebook', color: '#0866FF', url: 'https://facebook.com/{v}', ph: 'username' },
  { id: 'linkedin', name: 'LinkedIn', group: 'Social', icon: 'lu:briefcase', color: '#0A66C2', url: 'https://linkedin.com/in/{v}', ph: 'profile slug' },
  { id: 'pinterest', name: 'Pinterest', group: 'Social', icon: 'si:pinterest', color: '#BD081C', url: 'https://pinterest.com/{v}', ph: 'username' },
  { id: 'tumblr', name: 'Tumblr', group: 'Social', icon: 'si:tumblr', color: '#36465D', url: 'https://{v}.tumblr.com', ph: 'blog name' },
  { id: 'telegram', name: 'Telegram', group: 'Social', icon: 'si:telegram', color: '#26A5E4', url: 'https://t.me/{v}', ph: 'username' },
  { id: 'whatsapp', name: 'WhatsApp', group: 'Social', icon: 'si:whatsapp', color: '#25D366', url: 'https://wa.me/{v}', ph: 'phone number' },
  { id: 'signal', name: 'Signal', group: 'Social', icon: 'si:signal', color: '#3A76F0', copy: true, ph: 'username or link' },
  { id: 'vk', name: 'VK', group: 'Social', icon: 'si:vk', color: '#0077FF', url: 'https://vk.com/{v}', ph: 'username' },
  { id: 'wechat', name: 'WeChat', group: 'Social', icon: 'si:wechat', color: '#07C160', copy: true, ph: 'WeChat ID' },
  { id: 'line', name: 'LINE', group: 'Social', icon: 'si:line', color: '#00C300', copy: true, ph: 'LINE ID' },
  { id: 'kakaotalk', name: 'KakaoTalk', group: 'Social', icon: 'si:kakaotalk', color: '#FFCD00', copy: true, ph: 'Kakao ID' },
  { id: 'bereal', name: 'BeReal', group: 'Social', icon: 'si:bereal', color: '#ffffff', url: 'https://bere.al/{v}', ph: 'username' },
  { id: 'guilded', name: 'Guilded', group: 'Social', icon: 'si:guilded', color: '#F5C400', ph: 'profile URL' },
  { id: 'matrix', name: 'Matrix', group: 'Social', icon: 'si:matrix', color: '#ffffff', url: 'https://matrix.to/#/{v}', raw: true, ph: '@you:matrix.org' },
  { id: 'element', name: 'Element', group: 'Social', icon: 'si:element', color: '#0DBD8B', ph: 'link' },
  { id: 'keybase', name: 'Keybase', group: 'Social', icon: 'si:keybase', color: '#33A0FF', url: 'https://keybase.io/{v}', ph: 'username' },
  { id: 'quora', name: 'Quora', group: 'Social', icon: 'si:quora', color: '#B92B27', url: 'https://quora.com/profile/{v}', ph: 'profile name' },

  // Gaming
  { id: 'steam', name: 'Steam', group: 'Gaming', icon: 'si:steam', color: '#ffffff', url: 'https://steamcommunity.com/id/{v}', idUrl: 'https://steamcommunity.com/profiles/{v}', ph: 'custom URL or SteamID64' },
  { id: 'roblox', name: 'Roblox', group: 'Gaming', icon: 'si:roblox', color: '#ffffff', url: 'https://www.roblox.com/search/users?keyword={v}', idUrl: 'https://www.roblox.com/users/{v}/profile', ph: 'username or user ID' },
  { id: 'twitch', name: 'Twitch', group: 'Gaming', icon: 'si:twitch', color: '#9146FF', url: 'https://twitch.tv/{v}', ph: 'channel' },
  { id: 'kick', name: 'Kick', group: 'Gaming', icon: 'si:kick', color: '#53FC18', url: 'https://kick.com/{v}', ph: 'channel' },
  { id: 'epicgames', name: 'Epic Games', group: 'Gaming', icon: 'si:epicgames', color: '#ffffff', copy: true, ph: 'Epic display name' },
  { id: 'fortnite', name: 'Fortnite', group: 'Gaming', icon: 'si:fortnite', color: '#ffffff', url: 'https://fortnitetracker.com/profile/all/{v}', ph: 'Epic name' },
  { id: 'playstation', name: 'PlayStation', group: 'Gaming', icon: 'si:playstation', color: '#0070D1', url: 'https://psnprofiles.com/{v}', ph: 'PSN ID' },
  { id: 'xbox', name: 'Xbox', group: 'Gaming', icon: 'lu:gamepad-2', color: '#107C10', url: 'https://xboxgamertag.com/search/{v}', ph: 'gamertag' },
  { id: 'battlenet', name: 'Battle.net', group: 'Gaming', icon: 'si:battledotnet', color: '#148EFF', copy: true, ph: 'BattleTag#1234' },
  { id: 'riot', name: 'Riot Games', group: 'Gaming', icon: 'si:riotgames', color: '#EB0029', copy: true, ph: 'Name#TAG' },
  { id: 'valorant', name: 'Valorant', group: 'Gaming', icon: 'si:valorant', color: '#FA4454', url: 'https://tracker.gg/valorant/profile/riot/{v}/overview', ph: 'Name#TAG' },
  { id: 'lol', name: 'League of Legends', group: 'Gaming', icon: 'si:leagueoflegends', color: '#C28F2C', copy: true, ph: 'Name#TAG' },
  { id: 'minecraft', name: 'Minecraft', group: 'Gaming', icon: 'lu:pickaxe', color: '#62B47A', url: 'https://namemc.com/profile/{v}', ph: 'IGN' },
  { id: 'namemc', name: 'NameMC', group: 'Gaming', icon: 'si:namemc', color: '#ffffff', url: 'https://namemc.com/profile/{v}', ph: 'IGN' },
  { id: 'osu', name: 'osu!', group: 'Gaming', icon: 'si:osu', color: '#FF66AA', url: 'https://osu.ppy.sh/users/{v}', ph: 'username or ID' },
  { id: 'vrchat', name: 'VRChat', group: 'Gaming', icon: 'si:vrchat', color: '#ffffff', ph: 'profile URL' },
  { id: 'itchio', name: 'itch.io', group: 'Gaming', icon: 'si:itchdotio', color: '#FA5C5C', url: 'https://{v}.itch.io', ph: 'username' },
  { id: 'gamejolt', name: 'Game Jolt', group: 'Gaming', icon: 'si:gamejolt', color: '#CCFF00', url: 'https://gamejolt.com/@{v}', ph: 'username' },
  { id: 'chess', name: 'Chess.com', group: 'Gaming', icon: 'si:chessdotcom', color: '#81B64C', url: 'https://chess.com/member/{v}', ph: 'username' },
  { id: 'lichess', name: 'Lichess', group: 'Gaming', icon: 'si:lichess', color: '#ffffff', url: 'https://lichess.org/@/{v}', ph: 'username' },

  // Music & Video
  { id: 'youtube', name: 'YouTube', group: 'Music & Video', icon: 'si:youtube', color: '#FF0000', url: 'https://youtube.com/@{v}', ph: 'handle' },
  { id: 'spotify', name: 'Spotify', group: 'Music & Video', icon: 'si:spotify', color: '#1DB954', url: 'https://open.spotify.com/user/{v}', ph: 'user ID or link' },
  { id: 'soundcloud', name: 'SoundCloud', group: 'Music & Video', icon: 'si:soundcloud', color: '#FF5500', url: 'https://soundcloud.com/{v}', ph: 'username' },
  { id: 'applemusic', name: 'Apple Music', group: 'Music & Video', icon: 'si:applemusic', color: '#FA243C', ph: 'profile or playlist URL' },
  { id: 'lastfm', name: 'Last.fm', group: 'Music & Video', icon: 'si:lastdotfm', color: '#D51007', url: 'https://last.fm/user/{v}', ph: 'username' },
  { id: 'bandcamp', name: 'Bandcamp', group: 'Music & Video', icon: 'si:bandcamp', color: '#629AA9', url: 'https://{v}.bandcamp.com', ph: 'artist' },
  { id: 'deezer', name: 'Deezer', group: 'Music & Video', icon: 'si:deezer', color: '#A238FF', ph: 'profile URL' },
  { id: 'tidal', name: 'TIDAL', group: 'Music & Video', icon: 'si:tidal', color: '#ffffff', ph: 'profile URL' },
  { id: 'vimeo', name: 'Vimeo', group: 'Music & Video', icon: 'si:vimeo', color: '#1AB7EA', url: 'https://vimeo.com/{v}', ph: 'username' },
  { id: 'rumble', name: 'Rumble', group: 'Music & Video', icon: 'si:rumble', color: '#85C742', url: 'https://rumble.com/c/{v}', ph: 'channel' },
  { id: 'odysee', name: 'Odysee', group: 'Music & Video', icon: 'si:odysee', color: '#EF1970', url: 'https://odysee.com/@{v}', ph: 'channel' },
  { id: 'dailymotion', name: 'Dailymotion', group: 'Music & Video', icon: 'si:dailymotion', color: '#ffffff', url: 'https://dailymotion.com/{v}', ph: 'username' },
  { id: 'letterboxd', name: 'Letterboxd', group: 'Music & Video', icon: 'si:letterboxd', color: '#FF8000', url: 'https://letterboxd.com/{v}', ph: 'username' },
  { id: 'anilist', name: 'AniList', group: 'Music & Video', icon: 'si:anilist', color: '#02A9FF', url: 'https://anilist.co/user/{v}', ph: 'username' },
  { id: 'myanimelist', name: 'MyAnimeList', group: 'Music & Video', icon: 'si:myanimelist', color: '#2E51A2', url: 'https://myanimelist.net/profile/{v}', ph: 'username' },
  { id: 'crunchyroll', name: 'Crunchyroll', group: 'Music & Video', icon: 'si:crunchyroll', color: '#FF640A', ph: 'profile URL' },
  { id: 'trakt', name: 'Trakt', group: 'Music & Video', icon: 'si:trakt', color: '#ED1C24', url: 'https://trakt.tv/users/{v}', ph: 'username' },
  { id: 'imdb', name: 'IMDb', group: 'Music & Video', icon: 'si:imdb', color: '#F5C518', ph: 'profile URL' },
  { id: 'netflix', name: 'Netflix', group: 'Music & Video', icon: 'si:netflix', color: '#E50914', ph: 'link' },

  // Dev
  { id: 'github', name: 'GitHub', group: 'Dev', icon: 'si:github', color: '#ffffff', url: 'https://github.com/{v}', ph: 'username' },
  { id: 'gitlab', name: 'GitLab', group: 'Dev', icon: 'si:gitlab', color: '#FC6D26', url: 'https://gitlab.com/{v}', ph: 'username' },
  { id: 'codeberg', name: 'Codeberg', group: 'Dev', icon: 'si:codeberg', color: '#2185D0', url: 'https://codeberg.org/{v}', ph: 'username' },
  { id: 'gitea', name: 'Gitea', group: 'Dev', icon: 'si:gitea', color: '#609926', ph: 'profile URL' },
  { id: 'npm', name: 'npm', group: 'Dev', icon: 'si:npm', color: '#CB3837', url: 'https://npmjs.com/~{v}', ph: 'username' },
  { id: 'pypi', name: 'PyPI', group: 'Dev', icon: 'si:pypi', color: '#3775A9', url: 'https://pypi.org/user/{v}', ph: 'username' },
  { id: 'stackoverflow', name: 'Stack Overflow', group: 'Dev', icon: 'si:stackoverflow', color: '#F58025', ph: 'profile URL' },
  { id: 'leetcode', name: 'LeetCode', group: 'Dev', icon: 'si:leetcode', color: '#FFA116', url: 'https://leetcode.com/u/{v}', ph: 'username' },
  { id: 'hackthebox', name: 'Hack The Box', group: 'Dev', icon: 'si:hackthebox', color: '#9FEF00', ph: 'profile URL' },
  { id: 'tryhackme', name: 'TryHackMe', group: 'Dev', icon: 'si:tryhackme', color: '#C11111', url: 'https://tryhackme.com/p/{v}', ph: 'username' },
  { id: 'hackerone', name: 'HackerOne', group: 'Dev', icon: 'si:hackerone', color: '#ffffff', url: 'https://hackerone.com/{v}', ph: 'username' },
  { id: 'bugcrowd', name: 'Bugcrowd', group: 'Dev', icon: 'si:bugcrowd', color: '#F26822', url: 'https://bugcrowd.com/{v}', ph: 'username' },
  { id: 'devto', name: 'DEV', group: 'Dev', icon: 'si:devdotto', color: '#ffffff', url: 'https://dev.to/{v}', ph: 'username' },
  { id: 'medium', name: 'Medium', group: 'Dev', icon: 'si:medium', color: '#ffffff', url: 'https://medium.com/@{v}', ph: 'username' },
  { id: 'substack', name: 'Substack', group: 'Dev', icon: 'si:substack', color: '#FF6719', url: 'https://{v}.substack.com', ph: 'publication' },
  { id: 'huggingface', name: 'Hugging Face', group: 'Dev', icon: 'si:huggingface', color: '#FFD21E', url: 'https://huggingface.co/{v}', ph: 'username' },
  { id: 'kaggle', name: 'Kaggle', group: 'Dev', icon: 'si:kaggle', color: '#20BEFF', url: 'https://kaggle.com/{v}', ph: 'username' },
  { id: 'replit', name: 'Replit', group: 'Dev', icon: 'si:replit', color: '#F26207', url: 'https://replit.com/@{v}', ph: 'username' },
  { id: 'dribbble', name: 'Dribbble', group: 'Dev', icon: 'si:dribbble', color: '#EA4C89', url: 'https://dribbble.com/{v}', ph: 'username' },
  { id: 'behance', name: 'Behance', group: 'Dev', icon: 'si:behance', color: '#1769FF', url: 'https://behance.net/{v}', ph: 'username' },
  { id: 'figma', name: 'Figma', group: 'Dev', icon: 'si:figma', color: '#F24E1E', url: 'https://figma.com/@{v}', ph: 'handle' },
  { id: 'artstation', name: 'ArtStation', group: 'Dev', icon: 'si:artstation', color: '#13AFF0', url: 'https://artstation.com/{v}', ph: 'username' },
  { id: 'deviantart', name: 'DeviantArt', group: 'Dev', icon: 'si:deviantart', color: '#05CC47', url: 'https://deviantart.com/{v}', ph: 'username' },
  { id: 'pixiv', name: 'pixiv', group: 'Dev', icon: 'si:pixiv', color: '#0096FA', url: 'https://pixiv.net/users/{v}', ph: 'user ID' },

  // Creators & Money
  { id: 'patreon', name: 'Patreon', group: 'Creators & Money', icon: 'si:patreon', color: '#ffffff', url: 'https://patreon.com/{v}', ph: 'username' },
  { id: 'kofi', name: 'Ko-fi', group: 'Creators & Money', icon: 'si:kofi', color: '#FF5E5B', url: 'https://ko-fi.com/{v}', ph: 'username' },
  { id: 'buymeacoffee', name: 'Buy Me a Coffee', group: 'Creators & Money', icon: 'si:buymeacoffee', color: '#FFDD00', url: 'https://buymeacoffee.com/{v}', ph: 'username' },
  { id: 'paypal', name: 'PayPal', group: 'Creators & Money', icon: 'si:paypal', color: '#00A1E0', url: 'https://paypal.me/{v}', ph: 'paypal.me name' },
  { id: 'cashapp', name: 'Cash App', group: 'Creators & Money', icon: 'si:cashapp', color: '#00D632', url: 'https://cash.app/${v}', strip: '$', ph: '$cashtag' },
  { id: 'venmo', name: 'Venmo', group: 'Creators & Money', icon: 'si:venmo', color: '#008CFF', url: 'https://venmo.com/u/{v}', ph: 'username' },
  { id: 'onlyfans', name: 'OnlyFans', group: 'Creators & Money', icon: 'si:onlyfans', color: '#00AFF0', url: 'https://onlyfans.com/{v}', ph: 'username' },
  { id: 'fiverr', name: 'Fiverr', group: 'Creators & Money', icon: 'si:fiverr', color: '#1DBF73', url: 'https://fiverr.com/{v}', ph: 'username' },
  { id: 'upwork', name: 'Upwork', group: 'Creators & Money', icon: 'si:upwork', color: '#6FDA44', ph: 'profile URL' },
  { id: 'etsy', name: 'Etsy', group: 'Creators & Money', icon: 'si:etsy', color: '#F16521', url: 'https://etsy.com/shop/{v}', ph: 'shop name' },
  { id: 'ebay', name: 'eBay', group: 'Creators & Money', icon: 'si:ebay', color: '#E53238', url: 'https://ebay.com/usr/{v}', ph: 'username' },
  { id: 'kickstarter', name: 'Kickstarter', group: 'Creators & Money', icon: 'si:kickstarter', color: '#05CE78', ph: 'project URL' },
  { id: 'gofundme', name: 'GoFundMe', group: 'Creators & Money', icon: 'si:gofundme', color: '#00B964', ph: 'fundraiser URL' },
  { id: 'linktree', name: 'Linktree', group: 'Creators & Money', icon: 'si:linktree', color: '#43E55E', url: 'https://linktr.ee/{v}', ph: 'username' },
  { id: 'carrd', name: 'Carrd', group: 'Creators & Money', icon: 'si:carrd', color: '#596CAF', url: 'https://{v}.carrd.co', ph: 'site name' },
  { id: 'strava', name: 'Strava', group: 'Creators & Money', icon: 'si:strava', color: '#FC4C02', ph: 'profile URL' },
  { id: 'duolingo', name: 'Duolingo', group: 'Creators & Money', icon: 'si:duolingo', color: '#58CC02', url: 'https://duolingo.com/profile/{v}', ph: 'username' },
  { id: 'goodreads', name: 'Goodreads', group: 'Creators & Money', icon: 'si:goodreads', color: '#B7AD98', ph: 'profile URL' },

  // Crypto (click to copy address)
  { id: 'bitcoin', name: 'Bitcoin', group: 'Crypto', icon: 'si:bitcoin', color: '#F7931A', copy: true, ph: 'BTC address' },
  { id: 'ethereum', name: 'Ethereum', group: 'Crypto', icon: 'si:ethereum', color: '#ffffff', copy: true, ph: 'ETH address' },
  { id: 'solana', name: 'Solana', group: 'Crypto', icon: 'si:solana', color: '#9945FF', copy: true, ph: 'SOL address' },
  { id: 'litecoin', name: 'Litecoin', group: 'Crypto', icon: 'si:litecoin', color: '#A6A9AA', copy: true, ph: 'LTC address' },
  { id: 'monero', name: 'Monero', group: 'Crypto', icon: 'si:monero', color: '#FF6600', copy: true, ph: 'XMR address' },
  { id: 'dogecoin', name: 'Dogecoin', group: 'Crypto', icon: 'si:dogecoin', color: '#C2A633', copy: true, ph: 'DOGE address' },
  { id: 'tether', name: 'Tether', group: 'Crypto', icon: 'si:tether', color: '#50AF95', copy: true, ph: 'USDT address' },
  { id: 'binance', name: 'Binance', group: 'Crypto', icon: 'si:binance', color: '#F0B90B', copy: true, ph: 'Binance Pay ID' },
  { id: 'coinbase', name: 'Coinbase', group: 'Crypto', icon: 'si:coinbase', color: '#0052FF', copy: true, ph: 'address' },
  { id: 'opensea', name: 'OpenSea', group: 'Crypto', icon: 'si:opensea', color: '#2081E2', url: 'https://opensea.io/{v}', ph: 'username' },

  // Contact
  { id: 'email', name: 'Email', group: 'Contact', icon: 'lu:mail', color: '#ffffff', url: 'mailto:{v}', raw: true, ph: 'you@example.com' },
  { id: 'gmail', name: 'Gmail', group: 'Contact', icon: 'si:gmail', color: '#EA4335', url: 'mailto:{v}', raw: true, ph: 'you@gmail.com' },
  { id: 'proton', name: 'Proton Mail', group: 'Contact', icon: 'si:protonmail', color: '#6D4AFF', url: 'mailto:{v}', raw: true, ph: 'you@proton.me' },
  { id: 'phone', name: 'Phone', group: 'Contact', icon: 'lu:phone', color: '#ffffff', url: 'tel:{v}', raw: true, ph: '+1 555 0100' },
  { id: 'session', name: 'Session', group: 'Contact', icon: 'lu:lock', color: '#00F782', copy: true, ph: 'Session ID' },
  { id: 'zoom', name: 'Zoom', group: 'Contact', icon: 'si:zoom', color: '#0B5CFF', ph: 'meeting link' },

  // Other
  { id: 'website', name: 'Website', group: 'Other', icon: 'lu:globe', color: '#ffffff', ph: 'https://…' },
  { id: 'link', name: 'Custom link', group: 'Other', icon: 'lu:link', color: '#ffffff', ph: 'https://…' },
  { id: 'apple', name: 'Apple', group: 'Other', icon: 'si:apple', color: '#ffffff', ph: 'link' },
  { id: 'google', name: 'Google', group: 'Other', icon: 'si:google', color: '#4285F4', ph: 'link' },
  { id: 'amazon', name: 'Amazon wishlist', group: 'Other', icon: 'lu:gift', color: '#FF9900', ph: 'wishlist URL' },
  { id: 'cloudflare', name: 'Cloudflare', group: 'Other', icon: 'si:cloudflare', color: '#F38020', ph: 'link' },
  { id: 'vercel', name: 'Vercel', group: 'Other', icon: 'si:vercel', color: '#ffffff', ph: 'link' },
  { id: 'notion', name: 'Notion', group: 'Other', icon: 'si:notion', color: '#ffffff', ph: 'page URL' },
  { id: 'copy', name: 'Copy text', group: 'Other', icon: 'lu:copy', color: '#ffffff', copy: true, ph: 'text to copy on click' },
];

const BY_ID = new Map(PLATFORMS.map((p) => [p.id, p]));
export const platformById = (id) => BY_ID.get(id) || BY_ID.get('link');

const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|steam:\/\/|discord:\/\/|spotify:)/i;

export function safeHref(href) {
  const v = String(href || '').trim();
  if (!v) return null;
  if (SAFE_HREF.test(v)) return v;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/i.test(v)) return 'https://' + v;
  return null;
}

// Resolve a configured link item into { href } or { copy } (or null when empty).
export function resolveLink(item) {
  const p = platformById(item.platform);
  let v = String(item.value || '').trim();
  if (!v) return null;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return { href: safeHref(v) };
  if (p.idUrl && /^\d{5,22}$/.test(v)) return { href: p.idUrl.replace('{v}', v) };
  if (p.copy) return { copy: v };
  if (p.url) {
    if (p.strip && v.startsWith(p.strip)) v = v.slice(p.strip.length);
    if (!p.raw) v = v.replace(/^@/, '');
    const enc = p.raw ? encodeURI(v) : encodeURIComponent(v);
    return { href: p.url.replace('{v}', enc) };
  }
  const href = safeHref(v);
  return href ? { href } : { copy: v };
}

// Map a hostname (or loose platform name) to a platform id. Used by importers.
const HOSTS = {
  'discord.com': 'discord', 'discord.gg': 'discord', 'discordapp.com': 'discord',
  'x.com': 'x', 'twitter.com': 'x', 'instagram.com': 'instagram', 'tiktok.com': 'tiktok',
  'snapchat.com': 'snapchat', 'reddit.com': 'reddit', 'threads.net': 'threads', 'threads.com': 'threads',
  'bsky.app': 'bluesky', 'facebook.com': 'facebook', 'fb.com': 'facebook', 'linkedin.com': 'linkedin',
  'pinterest.com': 'pinterest', 'tumblr.com': 'tumblr', 't.me': 'telegram', 'telegram.me': 'telegram',
  'wa.me': 'whatsapp', 'whatsapp.com': 'whatsapp', 'signal.me': 'signal', 'vk.com': 'vk',
  'steamcommunity.com': 'steam', 'store.steampowered.com': 'steam', 'roblox.com': 'roblox',
  'twitch.tv': 'twitch', 'kick.com': 'kick', 'epicgames.com': 'epicgames', 'psnprofiles.com': 'playstation',
  'playstation.com': 'playstation', 'xbox.com': 'xbox', 'namemc.com': 'namemc', 'osu.ppy.sh': 'osu',
  'vrchat.com': 'vrchat', 'itch.io': 'itchio', 'gamejolt.com': 'gamejolt', 'chess.com': 'chess', 'lichess.org': 'lichess',
  'youtube.com': 'youtube', 'youtu.be': 'youtube', 'spotify.com': 'spotify', 'open.spotify.com': 'spotify',
  'soundcloud.com': 'soundcloud', 'music.apple.com': 'applemusic', 'last.fm': 'lastfm', 'bandcamp.com': 'bandcamp',
  'deezer.com': 'deezer', 'tidal.com': 'tidal', 'vimeo.com': 'vimeo', 'rumble.com': 'rumble', 'odysee.com': 'odysee',
  'letterboxd.com': 'letterboxd', 'anilist.co': 'anilist', 'myanimelist.net': 'myanimelist', 'trakt.tv': 'trakt',
  'imdb.com': 'imdb', 'crunchyroll.com': 'crunchyroll', 'github.com': 'github', 'gitlab.com': 'gitlab',
  'codeberg.org': 'codeberg', 'npmjs.com': 'npm', 'pypi.org': 'pypi', 'stackoverflow.com': 'stackoverflow',
  'leetcode.com': 'leetcode', 'hackthebox.com': 'hackthebox', 'tryhackme.com': 'tryhackme', 'hackerone.com': 'hackerone',
  'dev.to': 'devto', 'medium.com': 'medium', 'substack.com': 'substack', 'huggingface.co': 'huggingface',
  'kaggle.com': 'kaggle', 'replit.com': 'replit', 'dribbble.com': 'dribbble', 'behance.net': 'behance',
  'figma.com': 'figma', 'artstation.com': 'artstation', 'deviantart.com': 'deviantart', 'pixiv.net': 'pixiv',
  'patreon.com': 'patreon', 'ko-fi.com': 'kofi', 'buymeacoffee.com': 'buymeacoffee', 'paypal.me': 'paypal',
  'paypal.com': 'paypal', 'cash.app': 'cashapp', 'venmo.com': 'venmo', 'onlyfans.com': 'onlyfans',
  'fiverr.com': 'fiverr', 'upwork.com': 'upwork', 'etsy.com': 'etsy', 'ebay.com': 'ebay', 'kickstarter.com': 'kickstarter',
  'gofundme.com': 'gofundme', 'linktr.ee': 'linktree', 'carrd.co': 'carrd', 'strava.com': 'strava',
  'duolingo.com': 'duolingo', 'goodreads.com': 'goodreads', 'opensea.io': 'opensea', 'keybase.io': 'keybase',
  'matrix.to': 'matrix', 'guilded.gg': 'guilded', 'quora.com': 'quora', 'tracker.gg': 'valorant',
  'amazon.com': 'amazon', 'notion.so': 'notion', 'notion.site': 'notion', 'bere.al': 'bereal', 'zoom.us': 'zoom',
};

export function platformFromUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'mailto:') return 'email';
    if (u.protocol === 'tel:') return 'phone';
    let host = u.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    while (host) {
      if (HOSTS[host]) return HOSTS[host];
      const dot = host.indexOf('.');
      if (dot < 0) break;
      host = host.slice(dot + 1);
    }
  } catch { /* not a URL */ }
  return null;
}

const ALIASES = {
  twitter: 'x', 'x.com': 'x', ig: 'instagram', yt: 'youtube', gh: 'github', ps: 'playstation', psn: 'playstation',
  battle: 'battlenet', battlenet: 'battlenet', 'battle.net': 'battlenet', riotgames: 'riot', leagueoflegends: 'lol',
  league: 'lol', btc: 'bitcoin', eth: 'ethereum', sol: 'solana', ltc: 'litecoin', xmr: 'monero', doge: 'dogecoin',
  usdt: 'tether', mail: 'email', protonmail: 'proton', 'ko-fi': 'kofi', bmc: 'buymeacoffee', cash: 'cashapp',
  'cash app': 'cashapp', lastdotfm: 'lastfm', 'last.fm': 'lastfm', itch: 'itchio', 'itch.io': 'itchio',
  chessdotcom: 'chess', 'chess.com': 'chess', snap: 'snapchat', fb: 'facebook', tg: 'telegram', web: 'website',
  site: 'website', custom: 'link', url: 'link', soundcloud: 'soundcloud', applemusic: 'applemusic',
  'apple music': 'applemusic', epic: 'epicgames', 'epic games': 'epicgames', dev: 'devto', 'dev.to': 'devto',
};

export function platformFromName(name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  if (BY_ID.has(n)) return n;
  if (ALIASES[n]) return ALIASES[n];
  const compact = n.replace(/[^a-z0-9]/g, '');
  if (BY_ID.has(compact)) return compact;
  if (ALIASES[compact]) return ALIASES[compact];
  const hit = PLATFORMS.find((p) => p.name.toLowerCase().replace(/[^a-z0-9]/g, '') === compact);
  return hit ? hit.id : null;
}
