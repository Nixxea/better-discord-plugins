/**
 * @name SendVoiceMessages
 * @author Nixea
 * @version 0.1.2
 * @description Заменяет ogg аттачменты на войс месседжи
 * @source https://github.com/Nixxea/better-discord-plugins
 * @updateUrl https://raw.githubusercontent.com/Nixxea/better-discord-plugins/master/SendVoiceMessages/SendVoiceMessages.plugin.js
 */

const { Patcher, Webpack } = BdApi;
const { getModule } = Webpack;

function readFile(file) {
    const reader = new FileReader();
    return new Promise(resolve => {
        reader.onload = (evt) => {
            resolve(evt.target.result);
        };
        reader.readAsArrayBuffer(file);
    });
}

module.exports = class SendVoiceMessages {
    constructor(meta) {
        this.name = 'SendVoiceMessages';
        this.modules = {
            uploads: getModule(m => m?.prototype?._createMessage).prototype
        };
    }
    start() {
        Patcher.instead(this.name, this.modules.uploads, '_createMessage', async (self, args, original) => {
            const file = self.files?.[0];
            if (file?.mimeType === "audio/ogg") {
                file.filename = 'voice-message.ogg';
                args[1].flags ??= 0;
                args[1].flags |= 8192;

                const context = new AudioContext();
                const audio = await context.decodeAudioData(await readFile(file.item.file));
                file.durationSecs = audio.duration;
                
                const maxWaves = Math.max(10, Math.min(audio.duration * 2 | 0, 300));
                const channel = audio.getChannelData(0);
                const wavesLength = channel.byteLength / 4;
                const step = wavesLength / maxWaves | 0;
                const waves = Buffer.alloc(maxWaves);

                let maxValue = 0.25; // увеличение волны не более, чем в 4 раза
                for (const i32 of channel) {
                    const abs = Math.abs(i32);
                    if (abs > maxValue) maxValue = abs;
                }

                for (let n = 0; wavesLength > n; n += step) {
                    let sum = 0;
                    let max = 0;
                    for (let i = 0; i < step; i++) {
                        const val = Math.abs(channel[i + n]);
                        if (!val) break;
                        sum += val;
                        if (val > max) max = val;
                    }
                    
                    // Кринж, а именно среднее арифметическое от максимума и среднего значения по волне
                    waves[n / step] = ((max / maxValue * 255) + (sum / maxValue / step * 255)) / 2 | 0;
                }

                file.waveform = waves.toString('base64');
            }

            return original.apply(self, args);
        });
    }
    stop() {
        Patcher.unpatchAll(this.name);
    }
};