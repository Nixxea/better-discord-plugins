/**
 * @name SendVoiceMessages
 * @author Nixea
 * @version 0.1.0
 * @description Заменяет ogg аттачменты на войс месседжи
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
                args[1].flags = 8192;

                const context = new AudioContext();
                const audio = await context.decodeAudioData(await readFile(file.item.file));
                file.durationSecs = audio.duration;
                
                const maxWaves = Math.min(audio.duration * 2 | 0, 400);
                const channel = audio.getChannelData(0);
                const wavesLength = channel.byteLength / 4;
                const step = wavesLength / maxWaves | 0;
                const waves = Buffer.alloc(maxWaves);

                let maxValue = 0;
                for (const i32 of channel) {
                    const abs = Math.abs(i32);
                    if (abs > maxValue) maxValue = abs;
                }

                for (let n = 0; wavesLength > n; n += step) {
                    let sum = 0;
                    let max = 0;
                    for (let i = 0; i < step; i++) {
                        const val = channel[i + n];
                        sum += val;
                        if (val > max) max = val;
                    }
                    
                    // Кринж, а именно среднее арифметическое от максимума и среднего значения по волне
                    waves[n / step] = ((max * 255) + (sum / maxValue / step * 255)) / 2 | 0;
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