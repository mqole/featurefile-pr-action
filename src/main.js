import * as core from "@actions/core";
import * as github from "@actions/github";

// newline
const nl = '\n'
// github bullet point
const bullet = `- `
// feature key
const featureKey = `🔎`
// all files denotation (yes i know this looks kind of stupid go with it)
const allFiles = {
    key: 'All',
    value: 'files'
}

// diffTypes
class diffType {
    static mod = "modified"
    static rem = "removed"
    static add = "added"
    static na = "error"
}

// add a lil message to the end if files are modified, might be better to make a partial prototype
// TODO: dont need this message if the modified file is in an extant feature file
let modFlag = false

// has 'all files' already been used?
let allFlag = false

// OUTPUTS!
let modFiles = []
let addFiles = []
let remFiles = []

// error messages to output
let unknownFileList = []
let noFilesInFeature = false

async function run() {
    // get inputs:
    const mod = core.getInput('modified').split(' ') ?? []
    const rem = core.getInput('removed').split(' ') ?? []
    const add = core.getInput('added').split(' ') ?? []
    const basename = core.getInput('basename')
    const basesha = core.getInput('basesha')
    const headname = core.getInput('headname')
    const headsha = core.getInput('headsha')
    const prBody = github.context.payload.pull_request.body;

    core.info(`modified:`)
    core.info(mod)
    core.info('')
    core.info(`removed:`)
    core.info(rem)
    core.info('')
    core.info(`added:`)
    core.info(add)
    core.info('')

    if (!checkBody(prBody)) {
        console.log(`No feature key found in PR body. Will not leave a comment.`)
        return
    }

    let summary = `### Feature File Summary; head commit ${headsha} merging into ${basesha}${nl}`
    summary += `#### Here is a summary of all changes:${nl}<hr/>${nl}`

    let prFeatures = await prGetFeatures(prBody, mod, rem, add)
    let prText = await dictToString(prFeatures)
    summary += prText

    summary += `${nl}<hr/>${nl}`
    summary += await addErrorMessages()

    console.log(summary += `${nl}<hr/>${nl}`)
    core.setOutput('summary', summary)

    core.info(`validated modified:`)
    core.info(JSON.stringify(modFiles))
    core.setOutput('modFiles', modFiles)
    core.info('')
    core.info(`validated removed:`)
    core.info(JSON.stringify(remFiles))
    core.setOutput('remFiles', remFiles)
    core.info('')
    core.info(`validated added:`)
    core.info(JSON.stringify(addFiles))
    core.setOutput('addFiles', addFiles)
}

async function prGetFeatures(prBody, mod, rem, add) {
    const newLine = `\n`
    let curSlice = prBody
    let features = []

    while (curSlice.search(featureKey) > -1) {
        let startPos = curSlice.search(featureKey)
        let featureSlice = curSlice.slice(startPos + featureKey.length) // getting rid of key

        // handle name
        let nameEnd = featureSlice.search(newLine)
        let name = (featureSlice.slice(0, nameEnd)).trim()
        console.log(`feature: ${name}`)

        // iterate over filenames if applicable
        let files = []
        featureSlice = featureSlice.slice(nameEnd)
        let nextLine = featureSlice.search(newLine) + newLine.length
        featureSlice = featureSlice.slice(nextLine)

        // no contents, use all
        // if has contents, but contents are invalid, DONT use all
        let hasContents = false

        while (featureSlice.startsWith(bullet)) {
            // handle file
            hasContents = true
            let fileEnd = featureSlice.search(newLine)
            let file = featureSlice.slice(bullet.length, fileEnd).trim()
            
            let fileType = await validateFile(file, name, mod, rem, add)
            if (fileType == diffType.na) {
                console.log(`ERROR: file '${file}' specified in PR body, but not found in changed files!`)
                console.log(file)
                unknownFileList.push(file)
                console.log(unknownFileList)
            }
            else {
                files.push({
                    key: file,
                    value: fileType
                })
                console.log(`file: ${file}`)
                console.log(`type: ${fileType}`)
            }

            featureSlice = featureSlice.slice(fileEnd + newLine.length)
            nextLine = featureSlice.search(newLine)
        }
        
        if (files.length < 1 && !hasContents) {
            files.push(allFiles)
        }     
        features.push({
            key: name,
            value: files
        })

        console.log('')
        curSlice = curSlice.slice(startPos + featureKey.length) // it doesnt really matter what we set this to, so long as it doesnt have the emoji
    }

    return features
}

function checkBody(prBody) {
    // check if anything damn exists
    if (prBody.search(featureKey) == -1)
        return false
    core.setOutput('body-found', true)
    return true
}

async function validateFile(file, name, mod, rem, add,) {
    if (mod.includes(file)) {
        await appendDict(modFiles, name, file)
        return diffType.mod
    }
    else if (rem.includes(file)) {
        await appendDict(remFiles, name, file)
        return diffType.rem
    }
    else if (add.includes(file)) {
        await appendDict(addFiles, name, file)
        return diffType.add
    }
    return diffType.na
}

async function appendDict(dict, name, file) {
    for (const {key, value} of dict) {
        if (key == name) {
            value.push(file)
            return
        }
    }
    // no key exists yet
    dict.push({
        key: name,
        value: [file]
    })
}

async function dictToString(dict) {
    let out = ""

    for (const {key, value} of dict) {
        // first check if this feature file contains our 'all files' key
        // only one feature file can be an 'all files'.
        if (value.includes(allFiles) && !allFlag) {
            out += `**${key}:** All unspecified files${nl}`
            allFlag = true
        }
        else if (allFlag) {
            console.log(`ERROR: multiple features want to use all files! Discarding feature '${key}'`)
        }
        else {
            let addLines = ""
            let remLines = ""
            let modLines = ""
            for (const file of value) {
                let message = nl + bullet + file.key
                switch (file.value) {
                    case diffType.add:
                        addLines += message
                        break
                    case diffType.rem:
                        remLines += message
                        break
                    case diffType.mod:
                        modLines += message
                        break
                    default:
                        console.log(`ERROR: attempted to convert unidentified entry in dict '${key}': type not found for file '${file.key}'`)
                }
            }
            let lines = ""

            if (addLines != "") {
                lines += `Added:${nl}`
                lines += wrapIntoCodeBlock(addLines)
            }
            if (remLines != "") {
                lines += `Removed:${nl}`
                lines += wrapIntoCodeBlock(remLines)
            }
            if (modLines != "") {
                lines += `Modified:${nl}`
                lines += wrapIntoCodeBlock(modLines)
            }

            if (lines != "")
            {
                out += wrapIntoCollapsible(lines, key)
            }
            else console.log(`ERROR: no valid files found for feature '${key}'`)
            noFilesInFeature = true
        }    
        out += nl;
    }
    return out
}

async function addErrorMessages() {
    let markdown = ""

    if (unknownFileList.length > 0) {
        let lines = ""
        for (let file of unknownFileList) {
            lines += nl + bullet + file
        }
        markdown += `ERROR: The following files were listed in the PR, but could not be found in the changed files:${nl}`
        markdown += wrapIntoCodeBlock(lines)+nl
    }

    if (noFilesInFeature) {
        markdown += `ERROR: Some features in the PR have no files. Make sure:${nl}
- All file paths are spelled correctly${nl}
- If you're editing multiple features, you've listed the files that correspond to each feature${nl}`
    }

    return markdown
}


function wrapIntoCollapsible(markdown, title) {
    let out = `<details><summary>${title}</summary>${nl}<p>${nl}${nl}`
    out += markdown
    out += `${nl}</p>${nl}</details>${nl}`
    return out
}

function wrapIntoCodeBlock(markdown) {
    let out = `${nl}\`\`\`` // assumes we have a starting newline
    out += markdown
    out += `${nl}\`\`\`${nl}`
    return out
}

run();