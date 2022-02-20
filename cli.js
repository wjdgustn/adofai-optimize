const fs = require('fs');
const readline = require('readline');
const sharp = require('sharp');
const path = require('path');

const utils = require('./utils');
const { inputs } = require('./cli_input.json');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let input = [];

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

    if(!fs.existsSync(path.join('level', input[0]))) {
        console.log('해당 채보 파일이 없습니다.');
        process.exit(0);
    }

    const file = fs.readFileSync(path.join('level', input[0]));
    const adofai = utils.ADOFAIParser(file);
    const optimizeNum = input[1];
    const optimizeAll = input[2] === 'y';

    if(!adofai.pathData && !adofai.angleData) {
        console.log('이 파일은 얼불춤 채보가 아닙니다.');
        process.exit(0);
    }

    const allFiles = [];
    const dontOptimizeFiles = [];
    let targetFiles;

    const tagFiles = {};

    // temp
    // for(let i in adofai.actions) {
    //     const a = adofai.actions[i];
    //
    //     if(a.scale && typeof a.scale === 'object') adofai.actions[i].scale = a.scale[0];
    // }

    for(let a of adofai.actions.filter(a => [ 'AddDecoration' , 'MoveDecorations' ].includes(a.eventType))) {
        if(a.eventType === 'MoveDecorations' && !a.decorationImage) continue;

        const tags = a.tag.split(' ').map(a => a.trim());

        if(!fs.existsSync(path.join('level', a.decorationImage))) continue;

        if(!allFiles.includes(a.decorationImage)) allFiles.push(a.decorationImage);
        if(a.scale && a.scale[0] >= 100 && !dontOptimizeFiles.includes(a.decorationImage)) dontOptimizeFiles.push(a.decorationImage);

        for(let t of tags) {
            if(!tagFiles[t]) tagFiles[t] = [];
            if(!tagFiles[t].includes(a.decorationImage)) tagFiles[t].push(a.decorationImage);
        }
    }
    console.log(allFiles.sort());

    // for(let a of adofai.actions.filter(a => a.eventType === 'CustomBackground')) {
    //     if(!fs.existsSync(path.join('level', a.bgImage))) continue;
    //
    //     if(!allFiles.includes(a.bgImage)) allFiles.push(a.bgImage);
    //     if(a.unscaledSize >= 100 && !dontOptimizeFiles.includes(a.bgImage)) dontOptimizeFiles.push(a.bgImage);
    // }

    for(let a of adofai.actions.filter(a => a.eventType === 'MoveDecorations')) {
        const tags = a.tag.split(' ').map(a => a.trim());
        if(!a.scale) continue;
        if(a.scale[0] >= 100) for(let t of tags) if(tagFiles[t]) for(let f of tagFiles[t]) if(!dontOptimizeFiles.includes(f)) dontOptimizeFiles.push(f);
    }
    targetFiles = optimizeAll ? (process.argv.includes('--only') ?
        allFiles.filter(a => fs.readFileSync('./onlyFiles.txt').toString().trim().split('\r\n').includes(a))
        : allFiles.filter(a => !fs.readFileSync('./excludedFiles.txt').toString().trim().split('\r\n').includes(a))) : allFiles.filter(a => !dontOptimizeFiles.includes(a));

    for(let f of targetFiles) {
        let buffer;
        const metadata = await sharp(path.join('level', f)).metadata();
        console.log(f);
        if(metadata.format === 'png') buffer = await sharp(path.join('level', f)).resize({
            width: Math.round(metadata.width / optimizeNum),
            height: Math.round(metadata.height / optimizeNum)
        })
            .png({
                compressionLevel: 9
            })
            .toBuffer();
        else buffer = await sharp(path.join('level', f)).resize({
            width: Math.round(metadata.width / optimizeNum),
            height: Math.round(metadata.height / optimizeNum)
        })
            .toBuffer();

        fs.writeFileSync(path.join('level', f), buffer);
    }

    const appliedTags = [];

    for(let i in adofai.actions) {
        const a = adofai.actions[i];
        if(a.eventType === 'AddDecoration' && targetFiles.includes(a.decorationImage)) {
            const tags = a.tag.split(' ').map(a => a.trim());
            for(let t of tags) if(!appliedTags.includes(t)) appliedTags.push(t);

            adofai.actions[i].scale[0] *= optimizeNum;
            adofai.actions[i].scale[1] *= optimizeNum;
            adofai.actions[i].pivotOffset[0] /= optimizeNum;
            adofai.actions[i].pivotOffset[1] /= optimizeNum;
        }
    }

    outer: for(let i in adofai.actions) {
        const a = adofai.actions[i];

        if(a.eventType === 'MoveDecorations') {
            const tags = a.tag.split(' ').map(a => a.trim());
            for(let t of tags) {
                if(appliedTags.includes(t)) {
                    if(!adofai.actions[i].scale) continue outer;
                    adofai.actions[i].scale[0] *= optimizeNum;
                    adofai.actions[i].scale[1] *= optimizeNum;
                    continue outer;
                }
            }
        }

        if(a.eventType === 'CustomBackground' && targetFiles.includes(a.bgImage)) {
            adofai.actions[i].unscaledSize *= optimizeNum;
        }
    }

    const optimizedTagsMap = {};
    const optimizedFilenameMap = {};
    for(let i in adofai.actions) {
        const a = adofai.actions[i];

        const filename = a.decorationImage || a.bgImage;

        if(a.tag && process.argv.includes('--tag')) {
            const oldTags = a.tag.split(' ').map(a => a.trim());
            const newTags = [];

            for(let t of oldTags) {
                if(!optimizedTagsMap[t]) optimizedTagsMap[t] = (Object.keys(optimizedTagsMap).length + 1).toString();
                newTags.push(optimizedTagsMap[t]);
            }

            adofai.actions[i].tag = newTags.join(' ');
        }

        if(filename && process.argv.includes('--filename')) {
            let newName;
            if(!optimizedFilenameMap[filename]) {
                if(!fs.existsSync(path.join('level', filename))) continue;

                newName = (Object.keys(optimizedFilenameMap).length + 1).toString() + path.extname(filename);
                optimizedFilenameMap[filename] = newName;
                fs.renameSync(path.join('level', filename), path.join('level', newName));

                console.log(`${filename} --> ${newName}`);
            }
            if(!newName) newName = optimizedFilenameMap[filename];

            if(a.bgImage) adofai.actions[i].bgImage = newName;
            if(a.decorationImage) adofai.actions[i].decorationImage = newName;
        }
    }

    fs.writeFileSync(path.join('level', input[0]), JSON.stringify(adofai));
});