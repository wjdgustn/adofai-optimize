const fs = require('fs');
const readline = require('readline');
const path = require('path');

const utils = require('./utils');
const { inputs } = require('./cli_input_tag_optimize.json');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let input = [];

const levelDir = process.argv[2] === '--debug' ? 'level' : './';

console.log('이 프로그램은 원본 맵 파일과 이미지 파일을 덮어씌우므로, 백업 후 진행해주세요!\n');
process.stdout.write(inputs[0]);

rl.on('line', line => {
    input.push(line);
    if(input.length < inputs.length) process.stdout.write(inputs[input.length]);
    else rl.close();
}).on('close', async () => {
    if(input.length < inputs.length) {
        console.log('\n\n작업을 취소합니다.');
        process.exit(0);
    }

    input = input.map(a => isNaN(a) ? a : Number(a));

    if(!fs.existsSync(path.join(levelDir, input[0]))) {
        console.log('해당 채보 파일이 없습니다.');
        process.exit(0);
    }

    const file = fs.readFileSync(path.join(levelDir, input[0]));
    const adofai = utils.ADOFAIParser(file);

    if(!adofai.pathData && !adofai.angleData) {
        console.log('이 파일은 얼불춤 채보가 아닙니다.');
        process.exit(0);
    }

    const optimizedTagsMap = {};
    const optimizedEventTagsMap = {};
    const optimizedFilenameMap = {};

    if(adofai.settings.bgImage && fs.existsSync(path.join(levelDir, adofai.settings.bgImage))) {
        const filename = adofai.settings.bgImage;

        const newName = (Object.keys(optimizedFilenameMap).length + 1).toString() + path.extname(filename);
        optimizedFilenameMap[filename] = newName;
        fs.renameSync(path.join(levelDir, filename), path.join(levelDir, newName));

        console.log(`${filename} --> ${newName}`);

        adofai.settings.bgImage = newName;
    }

    for(let i in adofai.actions) {
        const a = adofai.actions[i];

        if(a.eventTag) {
            const oldTags = a.eventTag.split(' ').map(a => a.trim());
            const newTags = [];

            for(let t of oldTags) {
                if(!optimizedEventTagsMap[t]) optimizedEventTagsMap[t] = (Object.keys(optimizedEventTagsMap).length + 1).toString();
                newTags.push(optimizedEventTagsMap[t]);
            }

            adofai.actions[i].eventTag = newTags.join(' ');
        }
    }

    for(let i in adofai.actions) {
        const a = adofai.actions[i];

        const filename = a.decorationImage || a.bgImage;

        if(a.tag) {
            const oldTags = a.tag.split(' ').map(a => a.trim());
            const newTags = [];

            if(a.eventType === 'RepeatEvents') for(let t of oldTags) {
                if(!optimizedEventTagsMap[t]) optimizedEventTagsMap[t] = (Object.keys(optimizedEventTagsMap).length + 1).toString();
                newTags.push(optimizedEventTagsMap[t]);
            }
            else for(let t of oldTags) {
                if(!optimizedTagsMap[t]) optimizedTagsMap[t] = (Object.keys(optimizedTagsMap).length + 1).toString();
                newTags.push(optimizedTagsMap[t]);
            }

            adofai.actions[i].tag = newTags.join(' ');
        }

        if(filename) {
            let newName;
            if(!optimizedFilenameMap[filename]) {
                if(!fs.existsSync(path.join(levelDir, filename))) continue;

                newName = (Object.keys(optimizedFilenameMap).length + 1).toString() + path.extname(filename);
                optimizedFilenameMap[filename] = newName;
                fs.renameSync(path.join(levelDir, filename), path.join(levelDir, newName));

                console.log(`${filename} --> ${newName}`);
            }
            if(!newName) newName = optimizedFilenameMap[filename];

            if(a.bgImage) adofai.actions[i].bgImage = newName;
            if(a.decorationImage) adofai.actions[i].decorationImage = newName;
        }
    }

    fs.writeFileSync(path.join(levelDir, './tag_optimized.adofai'), JSON.stringify(adofai));
});