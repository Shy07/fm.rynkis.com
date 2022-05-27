import axios from 'axios'
import axiosRetry from 'axios-retry'
import _ from 'lodash'
import fp from 'lodash/fp'
import Decimal from 'decimal.js'
import crypto from 'crypto'
import md5 from 'md5'
import base64 from 'base-64'
import qs from 'qs'

interface Proxy {
  host: string,
  port: number,
  auth?: {
    username: string,
    password: string
  }
}

class Meting {
  VERSION: string = '1.5.7'

  raw: any
  data: any
  info: any
  error: string = ''
  status: any
  temp: any = {}

  server: string = ''
  proxyVal: Proxy | null = null
  formatVal: boolean = false
  header: any
  realIP: string = '118.31.65.90'

  constructor (value: string = 'netease') {
    this.site(value)
  }

  site (value: string) {
    const suppose = ['netease']
    this.server = suppose.includes(value) ? value : 'netease'
    this.header = this.curlSet()

    return this
  }

  cookie (value: string) {
    this.header['Cookie'] = value
    return this
  }

  format (value: boolean = true) {
    this.formatVal = value
    return this
  }

  proxy (value: Proxy) {
    this.proxyVal = value
    return this
  }

  search (keyword: string, option: any = {}) {
    const funcs: any = {
      netease: () => ({
        'method': 'POST',
        'url': 'http://music.163.com/api/cloudsearch/pc',
        'body': {
          's': keyword,
          'type'  : option.type ? option.type : 1,
          'limit' : option.limit ? option.limit : 30,
          'total' : 'true',
          'offset': option.page && option.limit ? (option.page - 1) * option.limit : 0
        },
        'encode': 'neteaseAESCBC',
        'format': 'result.songs'
      })
    }
    const api = funcs[this.server]()

    return this.exec(api)
  }

  song (id: string) {
    const funcs: any = {
      netease: () => ({
        'method': 'POST',
        'url': 'http://music.163.com/api/linux/forward',
        'body': {
          'method': 'POST',
          'params': {
            'c': '[{"id":' + id + ',"v":0}]'
          },
          'url': 'http://music.163.com/api/v3/song/detail'
        },
        'encode': 'neteaseAESCBC',
        'format': 'songs'
      })
    }
    const api = funcs[this.server]()

    return this.exec(api)
  }

  album (id: string) {
    const funcs: any = {
      netease: () => ({
        'method': 'POST',
        'url': 'http://music.163.com/api/v1/album/' + id,
        'body': {
          'total': 'true',
          'offset': '0',
          'id': id,
          'limit': '1000',
          'ext': 'true',
          'private_cloud': 'true'
        },
        'encode': 'neteaseAESCBC',
        'format': 'songs'
      })
    }
    const api = funcs[this.server]()

    return this.exec(api)
  }

  artist (id: string, limit: number = 50) {
    const funcs: any = {
      netease: () => ({
        'method': 'POST',
        'url'   : 'http://music.163.com/api/v1/artist/' + id,
        'body'  : {
          'ext': 'true',
          'private_cloud': 'true',
          'top': limit,
          'id': id
        },
        'encode': 'neteaseAESCBC',
        'format': 'hotSongs'
      })
    }
    const api = funcs[this.server]()

    return this.exec(api)
  }

  playlist (id: string) {
    const funcs: any = {
      netease: () => ({
        'method': 'POST',
        'url': 'http://music.163.com/api/linux/forward',
        'body': {
          'method': 'POST',
          'params': {
            's': 0,
            id,
            'n': 1000,
            't': 0
          },
          'url': 'http://music.163.com/api/v3/playlist/detail'
        },
        'encode': 'neteaseAESCBC',
        'format': 'playlist#tracks'
      })
    }
    const api = funcs[this.server]()

    return this.exec(api)
  }

  url (id: string, br: number = 320) {
    const funcs: any = {
      netease: () => ({
        'method': 'POST',
        'url': 'http://music.163.com/api/linux/forward',
        'body': {
          'method': 'POST',
          'params': {
            'ids': [id],
            'br': br * 1000
          },
          'url': 'http://music.163.com/api/song/enhance/player/url'
        },
        'encode': 'neteaseAESCBC',
        'decode': 'neteaseUrl'
      })
    }
    const api = funcs[this.server]()
    this.temp.br = br

    return this.exec(api)
  }

  lyric (id: string) {
    const funcs: any = {
      netease: () => ({
        'method': 'POST',
        'url': 'http://music.163.com/api/linux/forward',
        'body': {
          'method': 'POST',
          'params': {
            id,
            'os': 'linux',
            'lv': -1,
            'kv': -1,
            'tv': -1
          },
          'url': 'http://music.163.com/api/song/lyric'
        },
        'encode': 'neteaseAESCBC',
        'decode': 'neteaseLyric'
      })
    }
    const api = funcs[this.server]()

    return this.exec(api)
  }

  async pic (id: string, size: number = 300) {
    const funcs: any = {
      netease: () => {
        return 'https://p3.music.126.net/' + this.neteaseEncryptId(id) + '/' + id + '.jpg?param=' + size + 'y' + size
      }
    }
    const url = funcs[this.server]()

    return { url }
  }

  private bcdechex (dec: number) {
    let hex = ''
    do {
      const last = new Decimal(dec).mod(16).toNumber()
      hex = last.toString(16) + hex
      const subVal = new Decimal(dec).sub(last)
      dec = new Decimal(subVal).div(16).toNumber()
    } while (dec > 0)

    return hex
  }

  private str2hex (str: string) {
    let hex = ''
    for (let i = 0; i < str.length; i++) {
      const hexCode = '0' + str.codePointAt(i)?.toString(16)
      hex += hexCode.substring(hexCode.length - 2)
    }

    return hex
  }

  private hex2bin (str: string) {
    let ret = ''
    for (let i = 0; i < str.length - 1; i += 2) {
      const x = str.substring(i, i + 2)
      const c = String.fromCharCode(parseInt(x, 16))
      ret += c
    }
    return ret
  }

  private aes128cbc (key: string, iv: string, data: string) {
    const encipher = crypto.createCipheriv('aes-128-cbc', key, iv)
    let encoded = encipher.update(data, 'utf8', 'hex')
    encoded += encipher.final('hex')
    return encoded
  }

  private neteaseAESCBC = (api: any) => {
    const key = '7246674226682325323F5E6544673A51'
    const body = JSON.stringify(api.body)
    const cipher = crypto.createCipheriv('aes-128-ecb', this.hex2bin(key), null)
    let encoded = cipher.update(body, 'utf8', 'hex')
    encoded += cipher.final('hex')
    const eparams = encoded.toUpperCase()
    api.body = { eparams }
    return api
  }

  private neteaseEncryptId (id: string) {
    const magic = '3go8&$8*3*3h0k(2)2'.split('')
    const songId = `${id}`.split('')
    for (let i = 0; i < songId.length; i++) {
      songId[i] = String.fromCodePoint(
        (songId[i].codePointAt(0) || 0) ^ ((magic[i % magic.length]).codePointAt(0) || 0)
      )
    }
    const hash = base64.encode(this.hex2bin(md5(songId.join(''))))
    const result = hash.replace(/\//g, '_').replace(/\+/g, '-')

    return result
  }

  private neteaseUrl (data: any) {
    let url = null
    if (fp.get('data.0.uf.url')(data)) {
      data['data'][0]['url'] = data['data'][0]['uf']['url']
    }
    if (fp.get('data.0.url')(data)) {
      url = {
        'url': data['data'][0]['url'],
        'size': data['data'][0]['size'],
        'br': data['data'][0]['br'] / 1000
      }
    } else {
      url = {
        'url': '',
        'size': 0,
        'br': -1
      }
    }

    return url
  }

  private neteaseLyric (json: any) {
    if (!this.formatVal) return json
    const data = {
      'lyric': fp.get('lrc.lyric')(json) || '',
      'tlyric': fp.get('tlyric.lyric')(json) || ''
    }

    return data
  }

  private async exec (api: any) {
    if (api.encode) {
      const func = (this as any)[api.encode] as Function
      api = func.call(this, api)
    }

    await this.fetch(api)

    if (!this.formatVal) {
      return this.raw
    }

    this.data = this.raw

    if (api.decode) {
      const func = (this as any)[api.decode] as Function
      this.data = func.call(this, this.data)
    }

    if (api.format) {
      this.data = this.clean(this.data, api.format)
    }

    return this.data
  }

  private async fetch (api: any) {
    axiosRetry(axios, { retries: 3 })
    const res = await axios({
      method: api.method,
      url: api.url,
      params: api.method === 'GET' ? api.body : {},
      data: api.method === 'GET' ? {} : qs.stringify(api.body),
      proxy: this.proxyVal,
      headers: this.header
    } as any)
    const { status, data } = res

    this.raw = data
    this.status = status
    return this
  }

  private curlSet () {
    const funcs: any = {
      netease: () => ({
        'Referer': 'https://music.163.com/',
        'Cookie': 'appver=1.5.9; os=osx; __remember_me=true; osver=%E7%89%88%E6%9C%AC%2010.13.5%EF%BC%88%E7%89%88%E5%8F%B7%2017F77%EF%BC%89;',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_5) AppleWebKit/605.1.15 (KHTML, like Gecko)',
        'X-Real-IP': this.realIP,
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.8,gl;q=0.6,zh-TW;q=0.4',
        'Connection': 'keep-alive',
        'Content-Type': 'application/x-www-form-urlencoded'
      })
    }
    const result = funcs[this.server]()
    return result
  }

  private long2ip (long: number) {
    const MAX_IP_IN_LONG = 4294967295 // 255.255.255.255
    const MIN_IP_IN_LONG = 0 // 0.0.0.0

    if (typeof long !== 'number' ||
      long > MAX_IP_IN_LONG || long < MIN_IP_IN_LONG
    ) {
      return false
    }

    const ip = [
      long >>> 24,
      long >>> 16 & 0xFF,
      long >>> 8 & 0xFF,
      long & 0xFF
    ].join('.')

    return ip
  }

  private randBetween (min: number, max: number) {
    const [minVal, maxVal] = min > max ? [max, min] : [min, max]
    const rand = (maxVal - minVal) * Math.random() + min
    return Math.floor(rand)
  }

  private getRandomHex (length: number) {
    const maxLength = 8
    const min = Math.pow(16, Math.min(length, maxLength) - 1)
    const max = Math.pow(16,Math.min(length, maxLength)) - 1
    const n = Math.floor(Math.random() * (max - min + 1)) + min
    let r = n.toString(16)
    while (r.length < length) {
      r = r + this.getRandomHex(length - maxLength)
    }

    return r
  }

  private clean (raw: any, rule: string) {
    if (rule.length > 0) {
      raw = this.pickup(raw, rule)
    }
    if (!raw) {
      raw = []
    } else if (!raw[0] && raw.length) {
      raw = [raw]
    }
    const func = (this as any)[`format${fp.capitalize(this.server)}`] as Function
    const result = raw.map((val: any) => func.call(this, val))
    return result
  }

  private pickup (array: [] | any, rule: string) {
    rule.split('#').forEach((value: string) => {
      if (!array) return []
      array = array[value]
    })
    return array
  }

  private formatNetease (data: any) {
    const result: any = {
      'id': data.id,
      'name': data.name,
      'artist': [],
      'album': fp.get('al.name')(data),
      'pic_id': fp.get('al.pic_str')(data) || fp.get('al.pic')(data),
      'url_id': data.id,
      'lyric_id': data.id,
      'source': 'netease'
    }
    if (fp.get('al.picUrl')(data)) {
      const match: any = /\/(\d+)\./g.exec(fp.get('al.picUrl')(data))
      result['pic_id'] = match[1]
    }
    for (const vo of data.ar || []) {
      result.artist.push(vo.name)
    }

    return result
  }
}

export default Meting
