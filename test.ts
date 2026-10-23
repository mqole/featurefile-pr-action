// newline
const nl = '\n'
// github bullet point
const bullet = `- `
// all files denotation
const allFiles = 'All files'

async function run() {
    // get inputs:
    const basesha = 'basesha'
    const headsha = 'headsha'
    const prBody = `test pr
this is body
lala
lala
🔎 lalallala FEATURE NAME!!! -Feature name.
- point 1
- point 2

- not a point
🔎 SECONDE FEATURE.
- point 3
- point four
not a point

some other shit
waga baga bobo

🔎 feature to include all files
`

    let summary = [`### Feature File Summary; head commit ${headsha} merging into ${basesha}${nl}`]
    summary.push(`#### Here is a summary of which changes will be made to Feature Files:${nl}<hr/>${nl}`)
    
    let prFeatures = await prGetFeatures(prBody)
    let prText = await dictToString(prFeatures)
    summary.push(prText)

    summary.push(`${nl}<hr/>${nl}`) // to let the edit text format nicely
    let out : string = summary.join('')
    console.log(out)
}

async function prGetFeatures(prBody : string) {
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

        while (featureSlice.startsWith(bullet)) {
            // handle file
            let fileEnd = featureSlice.search(newLine)
            let file = featureSlice.slice(bullet.length, fileEnd)
            files.push(file)
            console.log(`file: ${file}`)

            featureSlice = featureSlice.slice(fileEnd + newLine.length)
            nextLine = featureSlice.search(newLine)
        }
        
        if (files.length < 1) {
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

async function dictToString(dict : {key: string, value: string[]}[]) {
    let out : string[] = []
    
    // i dont know how to do this properly LOL!!!!
    Object.entries(dict).forEach(([_, pair]) => {
        // first check if this feature file contains our 'all files' key
        // only one feature file can be an 'all files'.
        if (pair.value.includes(allFiles)) {
            out.push(`**${pair.key}:** ${allFiles}${nl}`)
        }
        else {
            let lines : string[] = []
            Object.entries(pair.value).forEach(([_, line]) => {
                lines.push(`${bullet}${line}${nl}`)
            });
            let wrapper = wrapIntoCollapsible(lines.join(''), pair.key)
            out.push(wrapper)
        }
    });

    return out.join('')
}

function wrapIntoCollapsible(markdown : string, title : string) {
    let out = [`<details><summary>${title}</summary>${nl}<p>${nl}${nl}`]
    out.push(markdown)
    out.push(`${nl}</p>${nl}</details>${nl}${nl}`)
    return out.join('')
}

run();