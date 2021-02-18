portals = {
    IPFS: [
        "https://player.d.tube/ipfs/",
        "https://ipfs.d.tube/ipfs/",
        "https://video.oneloveipfs.com/ipfs/",
        "https://ipfs.infura.io/ipfs/",
        "https://gateway.temporal.cloud/ipfs/",
        "https://gateway.pinata.cloud/ipfs/",
        "https://ipfs.eternum.io/ipfs/",
        "https://ipfs.io/ipfs/"
    ],
    BTFS: [
        "https://player.d.tube/btfs/",
        "https://btfs.d.tube/btfs/"
    ],
    Skynet: [
        "https://siasky.net/",
        "https://skydrain.net/",
        "https://sialoop.net/",
        "https://skynet.luxor.tech/",
        "https://skynet.tutemwesi.com/",
        "https://siacdn.com/",
        "https://vault.lightspeedhosting.com/"
    ]
}
steemAPI = [
    "https://api.steemit.com/",
    "https://techcoderx.com",
    "https://steemd.minnowsupportproject.org/",
    "https://anyx.io/",
    "https://steemd.privex.io",
    "https://api.steem.house"
]
avalonAPI = 'https://avalon.d.tube'
player = null
itLoaded = false
timeout = 1500
defaultOptions = {
    loop: false
}

if (window.location.search.indexOf('?v=') === 0) {
    // redirect query string to real url
    var newUrl = [window.location.href.split('?v=')[0]]
    newUrl.push('#!/')
    var rightPart = window.location.search.split('?v=')[1]
    if (rightPart.indexOf('&') === -1)
        newUrl.push(rightPart)
    else {
        var query = rightPart.split('&')
        newUrl.push(query[0])
        for (let i = 1; i < query.length; i++)
            if (query[i] == 'autoplay=1' || query[i] == 'auto_play=true') {
                newUrl.push('/true')
                break
            }
    }

    window.location.replace(newUrl.join(''))
}

var path = window.location.href.split("#!/")[1];
var videoAuthor = path.split("/")[0]
var videoPermlink = path.split("/")[1]
var autoplay = (path.split("/")[2] == 'true')
var nobranding = (path.split("/")[3] == 'true')
if (path.split("/")[4] && path.split("/")[4] !== "default")
    provider = path.split("/")[4]

var additionalOptions = {};
if (path.split("/")[5]) {
    // The 5th part is parsed as a URL-Parameters if set
    // https://stackoverflow.com/questions/8648892/how-to-convert-url-parameters-to-a-javascript-object
    additionalOptions = JSON.parse('{"' + decodeURI(path.split("/")[5]).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g,'":"') + '"}')
}

function getOption(key) {
    if(typeof additionalOptions[key] !== "undefined") {
        return additionalOptions[key] == "false" ? false : additionalOptions[key];
    }

    if(typeof defaultOptions[key] !== "undefined") {
        return defaultOptions[key] == "false" ? false : additionalOptions[key];
    }

    return null;
}

document.addEventListener("DOMContentLoaded", function(event) {
    startup()
});

function startup() {
    // if you don't pass anything in the first field (emb.d.tube/#!//)
    // you can pass JSOUN data in the second field
    // and skip blockchain loading time
    if (videoAuthor === '') {
        try {
            var json = JSOUN.decode(videoPermlink)
            console.log('Video JSON loaded from URL', json)
        } catch (error) {
            console.log('Bad video JSON', error)
            return
        }
        handleVideo(json)
    }
    else
        findAvalon(videoAuthor, videoPermlink, function(err, res) {
            if (err || !res) {
                console.log(err, res)
                findVideo()
            } else {
                console.log('Video JSON loaded from '+avalonAPI, res)
                handleVideo(res.json)
            }
        })
}

function findInShortTerm(hash, video, cb) {
    var gw = prov.getDefaultGateway(video)
    const url = gw + hash
    const request = new XMLHttpRequest();
    request.open("HEAD", url, true);
    request.onerror = function(e) {
        console.log('Error: ' + url)
    }
    request.onreadystatechange = function() {
        if (request.readyState === request.DONE) {
            if (request.status === 200) {
                const headers = request.getAllResponseHeaders()
                console.log(headers, gw)
                cb(true)
            } else cb()
        }
    }
    request.send();
}

function findAvalon(author, link, cb) {
    fetch(avalonAPI+'/content/'+author+'/'+link, {
        method: 'get',
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        }
    }).then(status).then(res => res.json()).then(function(res) {
        cb(null, res)
    }).catch(function(err) {
        cb(err)
    })
}

function findVideo(retries = 3) {
    var api = steemAPI[(3-retries)%steemAPI.length]
    var client = new LightRPC(api, {
        timeout: timeout
    })

    client.send('get_content', [videoAuthor, videoPermlink], {timeout: timeout}, function(err, b) {
        if (err) {
            console.log(retries, api, err)
            if (retries>0) {
                findVideo(--retries)
            } else {
                console.log('Stopped trying to load (tried too much)')
            }
            return
        }
        console.log('Video loaded from '+api, b)
        var a = JSON.parse(b.json_metadata).video;
        handleVideo(a)
    });
    timeout *= 2
}

function handleVideo(video) {
    if (!provider) provider = prov.default(video)
    console.log('Trying... '+provider)
    var redirectLink = 'https://'
    switch (provider) {
        // Our custom DTube Player
        case "IPFS":
        case "BTFS":
            var gw = prov.getDefaultGateway(video)
            if (prov.isLive(video))
                return createLivePlayer(video,autoplay)
            var qualities = generateQualities(video)
            if (!qualities || qualities.length == 0) {
                prov.tryNext(video)
                return
            }
            findInShortTerm(qualities[0].hash, video, function(isAvail) {
                addQualitiesSource(qualities, (isAvail ? gw : prov.getFallbackGateway()))
        
                var coverUrl = getCoverUrl(video)
                var spriteHash = getSpriteHash(video)
                var duration = getDuration(video)
                var subtitles = getSubtitles(video)
                createPlayer(coverUrl, autoplay, nobranding, qualities, spriteHash, duration, subtitles)
            })
            break;

        case "Skynet":
            var gw = prov.getDefaultGateway(video)
            if (prov.isLive(video))
                return createLivePlayer(video,autoplay)
            var qualities = generateQualities(video)
            if (!qualities || qualities.length == 0) {
                prov.tryNext(video)
                return
            }

            addQualitiesSource(qualities, gw, 'Skynet')
            
            var coverUrl = getCoverUrl(video)
            var spriteHash = getSpriteHash(video)
            var duration = getDuration(video)
            var subtitles = getSubtitles(video)
            
            createPlayer(coverUrl, autoplay, nobranding, qualities, spriteHash, duration, subtitles)
            break;

        // Redirects to 3rd party embeds
        case "Twitch":
            var parent = window.location.hostname
            if (window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0)
                parent = window.location.ancestorOrigins[0].split('//')[1]
            if (parent.indexOf(':') > -1)
                parent = parent.split(':')[0]
            if (video.twitch_type && video.twitch_type == 'clip')
              redirectLink += "clips.twitch.tv/embed?clip=" + getVideoId(video)
            else
                if (parseInt(getVideoId(video)) == getVideoId(video))
                    redirectLink +=  "player.twitch.tv/?video=v" + getVideoId(video)
                else
                    redirectLink += "player.twitch.tv/?channel=" + getVideoId(video)
            
            if (autoplay)
                redirectLink += "&autoplay=true"
            else
                redirectLink += "&autoplay=false"
            redirectLink += "&muted=false&parent="+parent
            break;

        case "Dailymotion":
            redirectLink += "www.dailymotion.com/embed/video/" + getVideoId(video)
            if (autoplay)
                redirectLink += "?autoplay=true"
            else
                redirectLink += "?autoplay=false"
            redirectLink += "&mute=false"
            break;

        case "Instagram":
            redirectLink += "www.instagram.com/p/" + getVideoId(video) + '/embed/'
            break;

        case "LiveLeak":
            redirectLink += "www.liveleak.com/e/" + getVideoId(video)
            break;

        case "Vimeo":
            redirectLink += "player.vimeo.com/video/" + getVideoId(video)
            if (autoplay)
                redirectLink += "?autoplay=1"
            else
                redirectLink += "?autoplay=0"
            redirectLink += "&muted=0"
            if(getOption("loop"))
                redirectLink += "&loop=1"
            break;

        case "Facebook":
            redirectLink += "www.facebook.com/v2.3/plugins/video.php?allowfullscreen=true"
            if (autoplay)
                redirectLink += "&autoplay=true"
            else
                redirectLink += "&autoplay=false"
            redirectLink += "&container_width=800&href=" + encodeURI('https://www.facebook.com/watch/?v=') + getVideoId(video)
            break;

        case "YouTube":
            redirectLink += "www.youtube.com/embed/" + getVideoId(video)
            if (autoplay)
                redirectLink += "?autoplay=1"
            else
                redirectLink += "?autoplay=0"
            redirectLink += "&showinfo=1"
            if (nobranding)
                redirectLink += "&modestbranding=1"
            if (getOption("loop"))
                redirectLink += "&loop=1"

            break;

        default:
            redirectLink = false
            break;
    }

    if (redirectLink && redirectLink != 'https://')
        window.location.replace(redirectLink)
}

function getVideoId(video) {
    if (video.providerName == provider && video.videoId)
        return video.videoId
    if (video.files && video.files[prov.dispToId(provider)])
        return video.files[prov.dispToId(provider)]
    return ''
}

function getCoverUrl(video) {
    var gw = 'https://snap1.d.tube/ipfs/'
    if (video.files && video.files.btfs && video.files.btfs.img && video.files.btfs.img["360"])
        return gw+video.files.btfs.img["360"]
    if (video.files && video.files.ipfs && video.files.ipfs.img && video.files.ipfs.img["360"])
        return gw+video.files.ipfs.img["360"]
    if (video.files && video.files.btfs && video.files.btfs.img && video.files.btfs.img["118"])
        return gw+video.files.btfs.img["118"]
    if (video.files && video.files.ipfs && video.files.ipfs.img && video.files.ipfs.img["118"])
        return gw+video.files.ipfs.img["118"]
    if (video.ipfs && video.ipfs.snaphash) return gw+video.ipfs.snaphash
    if (video.info && video.info.snaphash) return gw+video.info.snaphash
    if (video.files && video.files.youtube)
        return 'http://i.ytimg.com/vi/'+video.files.youtube+'/hqdefault.jpg'
    return ''
}

function getSpriteHash(video) {
    if (video.files && video.files.btfs && video.files.btfs.img && video.files.btfs.img.spr)
        return video.files.btfs.img.spr
    if (video.files && video.files.ipfs && video.files.ipfs.img && video.files.ipfs.img.spr)
        return video.files.ipfs.img.spr
    if (video.ipfs && video.ipfs.spritehash) return video.ipfs.spritehash
    if (video.content && video.content.spritehash) return video.content.spritehash
    if (video.info && video.info.spritehash) return video.info.spritehash
    return ''
}

function getDuration(video) {
    if (video.dur) return video.dur
    if (video.duration) return video.duration
    if (video.info && video.info.duration) return video.info.duration
}

function getSubtitles(video) {
    if (video.ipfs && video.ipfs.subtitles) return video.ipfs.subtitles
    if (video.content && video.content.subtitles) return video.content.subtitles
    if (video.files && video.files.ipfs && video.files.ipfs.sub) {
        var subs = []
        for (const lang in video.files.ipfs.sub) {
            subs.push({
                lang: lang,
                hash: video.files.ipfs.sub[lang]
            })
        }
        return subs
    }
    return null
}

function enableSprite(duration, sprite) {
    if (!duration) return
    if (!sprite) return
    var listThumbnails = {}
    var nFrames = 100
    if (duration < 100) nFrames = Math.floor(duration)
    for (let s = 0; s < nFrames; s++) {
        var nSeconds = s
        if (duration > 100) nSeconds = Math.floor(s * duration / 100)
        listThumbnails[nSeconds] = {
            src: spriteUrl(sprite),
            style: {
                margin: -72 * s + 'px 0px 0px 0px',
            }
        }
    }
    player.thumbnails(listThumbnails);
}

function createPlayer(snapUrl, autoplay, branding, qualities, sprite, duration, subtitles) {
    var c = document.createElement("video");
    if (snapUrl)
        c.poster = snapUrl;
    c.controls = true;
    c.autoplay = autoplay;
    c.id = "player";
    c.className = "video-js";
    c.style = "width:100%;height:100%";
    c.loop = getOption("loop");
    c.addEventListener('loadeddata', function() {
        if (c.readyState >= 3) {
            itLoaded = true
            // player.muted(true);
            // player.play();
            // player.muted(false);
            if (!duration) {
                duration = Math.round(player.duration())
                parent.postMessage({dur: duration}, "*")
                enableSprite(duration, sprite)
            }
        }
    });

    var video = document.body.appendChild(c);

    // Setting menu items
    var menuEntries = []
    menuEntries.push('PlaybackRateMenuButton')
    if (subtitles)
        menuEntries.push('SubtitlesButton')
    if (qualities.length > 1)
        menuEntries.push('ResolutionMenuButton')
    menuEntries.push('GatewaySwitcherMenuButton')


    var defaultQuality = qualities[0].label
    if (hasQuality('480p', qualities))
        defaultQuality = '480p'
    var persistedQuality = getStorageItem('dquality');
    if(persistedQuality !== null && hasQuality(persistedQuality, qualities)){
      defaultQuality = persistedQuality
    }
    
    player = videojs("player", {
        inactivityTimeout: 1000,
        sourceOrder: true,
        sources: qualities,
        techOrder: ["html5"],
        'playbackRates': [0.5, 0.75, 1, 1.25, 1.5, 2],
        controlBar: {
            children: {
                'playToggle': {},
                'muteToggle': {},
                'volumeControl': {},
                'currentTimeDisplay': {},
                'timeDivider': {},
                'durationDisplay': {},
                'liveDisplay': {},
                'flexibleWidthSpacer': {},
                'progressControl': {},
                'settingsMenuButton': {
                    entries: menuEntries
                },
                'fullscreenToggle': {}
            }
        },
        plugins: {
            persistvolume: {
                namespace: 'dtube'
            },
            IPFSGatewaySwitcher: {},
            videoJsResolutionSwitcher: {
                default: defaultQuality,
                dynamicLabel: true
            },
            statistics: {

            }
        }
    })
    enableSprite(duration, sprite)
    videojs('player').ready(function() {
        const adapter = new playerjs.VideoJSAdapter(this)
        
        let loadedVidUrl = player.options_.sources[0].src
        let loadedGateway = loadedVidUrl.split('/')[2]
        document.getElementsByClassName('vjs-settings-sub-menu-value')[document.getElementsByClassName('vjs-settings-sub-menu-value').length - 1].innerHTML = loadedGateway
        
        this.hotkeys({
            seekStep: 5,
            enableModifiersForNumbers: false
        });

        window.onmessage = function(e) {
            if (e.data.seekTo)
                player.currentTime(e.data.seekTime)
        }

        if (subtitles) {
            for (let i = 0; i < subtitles.length; i++) {
                player.addRemoteTextTrack({
                    kind: "subtitles",
                    src: subtitleUrl(subtitles[i].hash),
                    srclang: subtitles[i].lang,
                    label: subtitles[i].lang
                })
    
            }
        }

        adapter.ready()
    });

    player.brand({
        branding: !JSON.parse(nobranding),
        title: "Watch on DTube",
        destination: "http://d.tube/#!/v/" + videoAuthor + '/' + videoPermlink,
        destinationTarget: "_blank"
    })

    handleResize()
}

function createLivePlayer(video, autoplay) {
    let c = document.createElement("video")
    let snapUrl = getCoverUrl(video)
    if (snapUrl)
        c.poster = snapUrl
    c.controls = true
    c.autoplay = autoplay
    c.id = "player"
    c.className = "video-js"
    c.style = "width:100%;height:100%"
    c.addEventListener('loadeddata', function() {
        if (c.readyState >= 3) {
            itLoaded = true
            if (!duration) {
                duration = Math.round(player.duration())
                parent.postMessage({dur: duration}, "*")
            }
        }
    })

    document.body.appendChild(c)

    // Setting menu items
    var menuEntries = []
    menuEntries.push('PlaybackRateMenuButton')
    // menuEntries.push('ResolutionMenuButton')
    menuEntries.push('GatewaySwitcherMenuButton')

    player = videojs("player", {
        inactivityTimeout: 1000,
        techOrder: ["html5"],
        'playbackRates': [0.5, 0.75, 1, 1.25, 1.5, 2],
        controlBar: {
            children: {
                'playToggle': {},
                'muteToggle': {},
                'volumeControl': {},
                'currentTimeDisplay': {},
                'timeDivider': {},
                'durationDisplay': {},
                'liveDisplay': {},
                'flexibleWidthSpacer': {},
                'progressControl': {},
                'settingsMenuButton': {
                    entries: menuEntries
                },
                'fullscreenToggle': {}
            }
        },
        plugins: {
            persistvolume: {
                namespace: 'dtube'
            },
            IPFSGatewaySwitcher: {},
            // videoJsResolutionSwitcher: {
            //     dynamicLabel: true
            // },
            statistics: {}
        }
    })

    let initGw = prov.getDefaultGateway(video)

    player.src({
        src: m3u8Url(prov.isLive(video),initGw),
        type: 'application/x-mpegURL'
    })

    videojs('player').ready(function() {
        const adapter = new playerjs.VideoJSAdapter(this)
        
        document.getElementsByClassName('vjs-settings-sub-menu-value')[document.getElementsByClassName('vjs-settings-sub-menu-value').length - 1].innerHTML = initGw
        
        this.hotkeys({
            seekStep: 5,
            enableModifiersForNumbers: false
        });

        window.onmessage = function(e) {
            if (e.data.seekTo)
                player.currentTime(e.data.seekTime)
        }

        adapter.ready()
    })

    player.brand({
        branding: !JSON.parse(nobranding),
        title: "Watch on DTube",
        destination: "http://d.tube/#!/v/" + videoAuthor + '/' + videoPermlink,
        destinationTarget: "_blank"
    })

    handleResize()
}

function removePlayer() {
    var elem = document.getElementById('player');
    return elem.parentNode.removeChild(elem);
}

function subtitleUrl(ipfsHash) {
    return 'https://snap1.d.tube/ipfs/' + ipfsHash
}

function spriteUrl(ipfsHash) {
    return 'https://sprite.d.tube/btfs/' + ipfsHash
}

function m3u8Url(liveHref,gw) {
    if (liveHref[0].startsWith('dtc'))
        return avalonAPI + '/stream/' + liveHref[1] + '/' + liveHref[2] + '/master?gw=' + gw
    // todo HAlive
}

function generateQualities(a) {
    var qualities = []
    var provId = prov.dispToId(provider)
    // latest format
    if (a.files) {
        if (!a.files[provId] || !a.files[provId].vid) return [];
        for (const key in a.files[provId].vid) {
            if (key == 'src') {
                qualities.push({
                    label: 'Source',
                    type: 'video/mp4',
                    hash: a.files[provId].vid.src,
                    network: provider
                })
                continue
            }
            qualities.push({
                label: key+'p',
                type: 'video/mp4',
                hash: a.files[provId].vid[key],
                network: provider
            })
        }
        return qualities
    }

    // old video format
    if (a.ipfs) {
        if (a.ipfs.video240hash) {
            qualities.push({
                label: '240p',
                type: 'video/mp4',
                hash: a.ipfs.video240hash,
            })
        }
        if (a.ipfs.video480hash) {
            qualities.push({
                label: '480p',
                type: 'video/mp4',
                hash: a.ipfs.video480hash,
            })
        }
        if (a.ipfs.video720hash) {
            qualities.push({
                label: '720p',
                type: 'video/mp4',
                hash: a.ipfs.video720hash,
            })
        }
        if (a.ipfs.video1080hash) {
            qualities.push({
                label: '1080p',
                type: 'video/mp4',
                hash: a.ipfs.video1080hash,
            })
        }
        if (a.ipfs.videohash) {
            qualities.push({
                label: 'Source',
                type: 'video/mp4',
                hash: a.ipfs.videohash,
            })
        }
    } else {
        // super old video format
        if (a.content && a.content.video240hash) {
            qualities.push({
                label: '240p',
                type: 'video/mp4',
                hash: a.content.video240hash,
            })
        }
        if (a.content && a.content.video480hash) {
            qualities.push({
                label: '480p',
                type: 'video/mp4',
                hash: a.content.video480hash,
            })
        }
        if (a.content && a.content.video720hash) {
            qualities.push({
                label: '720p',
                type: 'video/mp4',
                hash: a.content.video720hash,
            })
        }
        if (a.content && a.content.video1080hash) {
            qualities.push({
                label: '1080p',
                type: 'video/mp4',
                hash: a.content.video1080hash,
            })
        }
        if (a.content && a.content.videohash) {
            qualities.push({
                label: 'Source',
                type: 'video/mp4',
                hash: a.content.videohash,
            })
        }
    }
    return qualities
}

function addQualitiesSource(qualities, gateway, prov) {
    if (prov == 'Skynet') {
        for (let i = 0; i < qualities.length; i++) {
            qualities[i].src = gateway + qualities[i].hash
        }
        return
    }
    for (let i = 0; i < qualities.length; i++) {
        qualities[i].src = gateway + qualities[i].hash
    }
}

function hasQuality(label, qualities) {
    for (let i = 0; i < qualities.length; i++) 
        if (qualities[i].label == label) return true
    return false
}

window.onresize = handleResize;
function handleResize() {
    if (!window) return
    if (document.getElementsByClassName('vjs-time-control').length != 3) return
    if (window.innerWidth >= 360) {
        document.getElementsByClassName('vjs-time-control')[0].style.display = "block"
        document.getElementsByClassName('vjs-time-control')[1].style.display = "block"
        document.getElementsByClassName('vjs-time-control')[2].style.display = "block"
    } else {
        document.getElementsByClassName('vjs-time-control')[0].style.display = "none"
        document.getElementsByClassName('vjs-time-control')[1].style.display = "none"
        document.getElementsByClassName('vjs-time-control')[2].style.display = "none"
    }
}
