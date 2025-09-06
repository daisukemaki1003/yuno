import functions from '@google-cloud/functions-framework'

export const helloGET = (req, res) => {
    res.send('Hello World!');
});
