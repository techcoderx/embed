var allProviders = [
    {id: 'btfs', disp: 'BTFS', dht: 1},
    {id: 'ipfs', disp: 'IPFS', dht: 1},
    {id: 'sia', disp: 'Skynet', dht: 1},
    {id: 'youtube', disp: 'YouTube'},
    {id: 'twitch', disp: 'Twitch'},
    {id: 'dailymotion', disp: 'Dailymotion'},
    {id: 'instagram', disp: 'Instagram'},
    {id: 'liveleak', disp: 'LiveLeak'},
    {id: 'vimeo', disp: 'Vimeo'},
    {id: 'facebook', disp: 'Facebook'},
]
var failedProviders = []
provider = null
prov = {
    idToDisp: function(id) {
        for (let i = 0; i < allProviders.length; i++)
            if (allProviders[i].id == id)
                return allProviders[i].disp
        return
    },
    dispToId: function(disp) {
        for (let i = 0; i < allProviders.length; i++)
        if (allProviders[i].disp == disp)
            return allProviders[i].id
    return
    },
    tryNext: function(video) {
        failedProviders.push(provider)
        var available = this.available(video)
        var reallyAvailable = []
        for (let i = 0; i < available.length; i++) {
            if (failedProviders.indexOf(available[i]) == -1)
                reallyAvailable.push(available[i])
        }
        if (reallyAvailable.length > 0) {
            provider = reallyAvailable[0]
            handleVideo(video)
        }
    },
    getDefaultGateway: function(video) {
        if (provider == 'IPFS' && video && video.files && video.files.ipfs && video.files.ipfs.gw)
            return video.files.ipfs.gw + '/ipfs/'
        if (provider == 'BTFS' && video && video.files && video.files.btfs && video.files.btfs.gw)
            return video.files.btfs.gw + '/btfs/'
        if (provider == 'IPFS') return portals.IPFS[0]
        if (provider == 'BTFS') return portals.BTFS[0]
        if (provider == 'Skynet') return portals.Skynet[0]
        return
    },
    getFallbackGateway: function() {
        if (provider == 'IPFS') return portals.IPFS[1]
        if (provider == 'BTFS') return portals.BTFS[1]
        if (provider == 'Skynet') return portals.Skynet[1]
    },
    available: function(video) {
        var provs = []
        if (video && video.files) {
            for (let i = 0; i < allProviders.length; i++) {
                if (allProviders[i].dht == 1) {
                    if (
                        video.files[allProviders[i].id] &&
                        ((video.files[allProviders[i].id].vid &&
                        Object.keys(video.files[allProviders[i].id].vid).length > 0) ||
                        (video.files[allProviders[i].id].live &&
                        typeof video.files[allProviders[i].id].live.href === 'string'))
                    ) {
                        provs.push(allProviders[i].disp)
                    }
                } else {
                    if (video.files[allProviders[i].id])
                        provs.push(allProviders[i].disp)
                }
            }
        }
        if (video && video.providerName && provs.indexOf(video.providerName) == -1) 
            provs.push(video.providerName)
        return provs
    },
    default: function(video) {
        if (video && video.providerName) return video.providerName
        if (video && video.files) {
            for (let i = 0; i < allProviders.length; i++) {
                if (allProviders[i].dht == 1) {
                    if (
                        video.files[allProviders[i].id] &&
                        ((video.files[allProviders[i].id].vid &&
                        Object.keys(video.files[allProviders[i].id].vid).length > 0) ||
                        (video.files[allProviders[i].id].live &&
                        typeof video.files[allProviders[i].id].live.href === 'string'))
                    ) {
                        return allProviders[i].disp
                    }
                } else {
                    if (video.files[allProviders[i].id])
                        return allProviders[i].disp
                }
            }
        }
        return 'IPFS'
    },
    isLive: (video) => {
        if (video && video.files)
            for (let i in allProviders) if (allProviders[i].dht == 1)
                if (video.files[allProviders[i].id] && video.files[allProviders[i].id].live && typeof video.files[allProviders[i].id].live.href === 'string') {
                    let splitRef = video.files[allProviders[i].id].live.href.split('/')
                    if (splitRef.length === 3)
                        return splitRef
                }
        return false
    }
}