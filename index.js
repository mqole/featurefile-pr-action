const core = require('@actions/core')
const github = require("@actions/github");

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
    
    // newline
    const nl = '%0D%0A'

    core.info(prBody)

    let out = 'Feature File Summary; head commit ${headsha} merging into ${basesha}${nl}'
    out.push('Here is a summary of all changes:${nl}${nl}')
    
    out = wrapIntoCollapsible(out)
    core.setOutput(out)
}

async function prGetFeatures(prBody) {
    const featureKey = '🔎'
    let curSlice = prBody
    let features = []

    while (curSlice.search(featureKey) > -1){
        let startPos = curSlice.search(featureKey)
        curSlice = curSlice.slice(startPos + 1) // getting rid of emoji
    }

    return features
}

async function wrapIntoCollapsible(markdown) {
    let out = "<details><summary>{title}</summary>${nl}<p>${nl}${nl}" + markdown
    return out.push("${nl}</p>${nl}</details>")
}

run();