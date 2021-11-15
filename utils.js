const JSON5 = require('json5');

module.exports.ADOFAIParser = level => {
    try {
        return JSON5.parse(level);
    }
    catch (e) {
        return JSON5.parse(String(level).trim()
            .replaceAll(', ,', ',')
            .replaceAll(',,', ',')
            .replaceAll('],\n}', ']\n}')
            .replaceAll('}\n', '},\n')
            .replaceAll('},\n\t]', '}\n\t]')
            .replaceAll(', },', ' },')
            .replaceAll(', }', ' }')
            .replaceAll('\n', '')
            .replaceAll('}\n', '},\n'));
    }
}