import * as core from "@actions/core";
import * as github from "@actions/github";

// newline
const nl = '\n'
// github bullet point
const bullet = `- `
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
    core.info(`basename:`)
    core.info(basename)
    core.info('')
    core.info(`headname:`)
    core.info(headname)
    core.info('')

    let summary = `### Feature File Summary; head commit ${headsha} merging into ${basesha}${nl}`
    summary += `#### Here is a summary of all changes:${nl}<hr/>${nl}`

    let prFeatures = await prGetFeatures(prBody, mod, rem, add)
    let prText = await dictToString(prFeatures)
    summary += prText

    summary += `${nl}<hr/>${nl}`
    summary += await addErrorMessages()

    console.log(summary)
    core.setOutput('summary', summary)
}

async function prGetFeatures(prBody, mod, rem, add) {
    const featureKey = `🔎`
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
            
            let fileType = await validateFile(file, mod, rem, add)
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

async function validateFile(file, mod, rem, add,) {
    if (mod.includes(file)) {
        return diffType.mod
    }
    else if (rem.includes(file)) {
        return diffType.rem
    }
    else if (add.includes(file)) {
        return diffType.add
    }
    return diffType.na
}

async function dictToString(dict) {
    let out = ""

    for (const {key, value} of dict) {
        // first check if this feature file contains our 'all files' key
        // only one feature file can be an 'all files'.
        if (value.includes(allFiles)) {
            out += `**${key}:** All unspecified files${nl}` // TODO
        }
        else {
            let addLines = ""
            let remLines = ""
            let modLines = ""
            for (const file of value) {
                let message = bullet + file.key + nl
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
                lines += wrapIntoCodeBlock(addLines)+nl
            }
            if (remLines != "") {
                lines += `Removed:${nl}`
                lines += wrapIntoCodeBlock(remLines)+nl
            }
            if (modLines != "") {
                lines += `Modified:${nl}`
                lines += wrapIntoCodeBlock(modLines)+nl
            }

            if (lines != "")
            {
                out += wrapIntoCollapsible(lines, key)
            }
            else console.log(`ERROR: no valid files found for feature '${key}'`)
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
        - If you're editing multiple features, you've listed the files that correspond to each feature`
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
    let out = `${nl}\`\`\`${nl}`
    out += markdown
    out += `${nl}\`\`\`${nl}`
    return out
}

run();