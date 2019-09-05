import md2json = require('md-2-json');
import jsyaml = require('js-yaml');
import fs = require('fs');
import csv = require('export-to-csv');
import { stringify } from 'querystring';


// CSV configuration
const csvOptions = {
    fieldSeparator: ',',
    quoteStrings: '"',
    decimalSeparator: '.',
    showLabels: true,
    showTitle: false,
    title: 'moveProgression',
    useTextFile: false,
    useBom: true,
    useKeysAsHeaders: true,
    // headers: ['Column 1', 'Column 2', etc...] <-- Won't work with useKeysAsHeaders present!
};

const csvExporter = new csv.ExportToCsv(csvOptions);

function writeToCSV(rows: MoveObj[]): void {
    let csvData = csvExporter.generateCsv(rows, true);
    // console.log(csvData);
    fs.writeFileSync('Personal Development Framework.csv', csvData);
}


// Types
interface TopicContent {
    level: number;
    criteria: string[];
    exampleCriteria: Array<{
        criteria: string,
        examples: string[]
    }>;
}

interface Topic {
    name: string;
    title: string;
    content: TopicContent[]
}

interface MonzoObj {
    title: string;
    sidebarTitle: string;
    sidebarGroup: string;
    yaml: boolean;
    levels: number;
    homepage: boolean;
    topics: Topic[];
}

interface MoveObj {
    role: string;
    topic: string;
    criterion: string;
    examples?: string;
}


// Functions
function rebrandString(original: string) {
    return original.replace('Monzo', 'Move');
}

function parseFile(frameworkFilePath: string): Promise<MoveObj[]> {
    return new Promise(function (resolve, reject) {
        fs.readFile(frameworkFilePath, 'utf8', function(err, data) {
            if (err) reject(err);

            // strip non-yaml content from file
            let yaml = data.split('---\n')[1];

            // convert from YAML to MonzoObj
            let input: MonzoObj = jsyaml.safeLoad(yaml);

            // convert from MonzoObj to MoveObj
            let outputArray: MoveObj[] = [];
            let guild = input.sidebarGroup;
            let role = input.sidebarTitle;
            input.topics.forEach((t: Topic) => {
                let topicName = t.name;
                let topicContent: TopicContent[] = t.content;
                topicContent.forEach((tc: TopicContent) => {
                    let level = tc.level;
                    let criteria: string[] = tc.criteria;
                    if (criteria) {
                        criteria.forEach(criterion => {
                            let output: MoveObj = {
                                role: role.concat(' ', guild),
                                topic: topicName.concat(' ', level.toString()),
                                criterion: rebrandString(criterion),
                                examples: ''
                            }
                            //console.log(output);
                            outputArray.push(output);
                        });
                    }
                    let exampleCriteria: Array<{
                        criteria: string,
                        examples: string[]
                    }> = tc.exampleCriteria;
                    if(exampleCriteria) {
                        exampleCriteria.forEach(exampleCriterion => {
                            let output: MoveObj = {
                                role: role.concat(' ', guild),
                                topic: topicName.concat(' ', level.toString()),
                                criterion: rebrandString(exampleCriterion.criteria),
                                examples: rebrandString(exampleCriterion.examples.join('; '))
                            }
                            //console.log(output);
                            outputArray.push(output);
                        });
                    }
                })
            });
            resolve(outputArray);
        });
    });
}

const dictionary: { [titke: string]: string } = {
    a: 'foo',
    b: 'bar',
}

function combineCriterion(criteria: MoveObj[]): MoveObj[] {

    // collect criteria with the same criterion together
    let criteriaMap = new Map<string, MoveObj[]>();
    criteria.forEach(c => {
        let title = c.criterion;
        if (criteriaMap.has(title)) {
            criteriaMap.get(title).push(c);
        } else {
            criteriaMap.set(title, [c]);
        }
    });

    // squish those criteria together, using comma-separated lists for role, topic and exmaples
    let combinedCriteria = [];
    const uniqueFilter = (value, index, self) => {
        return self.indexOf(value) === index
    }
    criteriaMap.forEach((values: MoveObj[], key: string) => {
        combinedCriteria.push({
            criterion: values[0].criterion,
            role: values.map(v => v.role).join(', '),
            topic: values.map(v => v.topic).filter(uniqueFilter).join(', '),
            examples: values.map(v => v.examples).filter(uniqueFilter).join('; '),
        });
    });
    return combinedCriteria;
}

// Main routine starts here
let frameworkFilePaths = [
    'frameworks/engineering/backend.md',
    'frameworks/engineering/data.md',
    'frameworks/engineering/mobile.md',
    'frameworks/engineering/qualityanalyst.md',
    'frameworks/engineering/web.md',
    'frameworks/product.md',
    'frameworks/techops.md',
    'frameworks/generic.md'
];

let promises: Promise<MoveObj[]>[] = [];
frameworkFilePaths.forEach((framework: string) => {
    promises.push(parseFile(framework))
});

Promise.all(promises)
.then(frameworks => {
    // flatten frameworks
    let rows: MoveObj[] = [];
    frameworks.forEach((f: MoveObj[]) => rows = rows.concat(f));

    // combine rows which have the same value of 'criterion'
    rows = combineCriterion(rows);

    // write the combined set of all framework rows to CSV
    console.log(rows.length);
    writeToCSV(rows);
})
.catch(err => {
    console.error(err);
});



