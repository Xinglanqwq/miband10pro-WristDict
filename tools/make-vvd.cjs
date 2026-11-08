const path = require('path')
const emu = require('@aiot-toolkit/emulator')

async function main() {
  const sdkHome = 'C:\\Users\\Xinglan\\.vela\\sdk'
  const vvdHome = 'C:\\Users\\Xinglan\\.vela\\vvd'
  const m = new emu.VvdManager({ sdkHome, vvdHome })

  const skins = await m.getVelaSkinList()
  console.log('skins:', JSON.stringify(skins.map(s => ({ name: s.name, path: s.path }))))

  const skin = skins.find(s => s.name === 'xiaomi_band_pro') || skins[0]
  const imageDir = path.join(sdkHome, 'system-images', 'vela-miwear-watch-5.0')
  const name = 'Vela_Band10Pro'

  m.createVvd({
    name,
    arch: 'arm',
    width: '336',
    height: '480',
    skin: skin && skin.name,
    'skin.path': skin && skin.path,
    imageDir,
    imageType: 'vela-miwear-watch-5.0',
    customLcdRadius: ''
  })
  console.log('created vvd:', name, 'skin:', skin && skin.name)
  console.log('vvd dir:', path.join(vvdHome, name + '.vvd'))
}

main().catch(e => { console.error('ERR', e); process.exit(1) })
