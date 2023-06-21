/**
 * @name CommandsLibrary
 * @author Nixea
 * @version 0.1.0
 * @description Библиотека для добавления своих встроенных команд
 */

const { Patcher, Webpack } = BdApi;
const { getModule } = Webpack;

module.exports = class CommandsLibrary {
    constructor(meta) {
        this.name = 'CommandsLibrary';
        this.loaded = false;
        this.commands = [];

        this.modules = {
            commands: getModule(m => typeof m?.Kh === 'function' && m?.Tm)
        };
    }

    start() {
        Patcher.after(this.name, this.modules.commands, 'Kh', (self, args, ret) => {
            return args[0] === 1 ? ret.concat(this.commands) : ret;
        });
        
        this.loaded = true;
    }

    registerCommand(command) {
        const currentCommands = this.modules.commands.Kh(1, true, false);
        
        const maxId = currentCommands.sort((a, b) => b.id - a.id).at(-1).id;
        console.log(maxId);
        command.id = (maxId - 1).toString();
        command.applicationId = '-1';

        this.commands.push(command);
        return () => this.unregisterCommand(command.id);
    }

    unregisterCommand(id) {
        return Boolean(this.commands.splice(this.commands.findIndex(c => c.id === id), 1).length);
    }

    stop() {
        Patcher.unpatchAll(this.name);
        this.loaded = false;
    }
};