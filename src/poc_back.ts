import inquirer from 'inquirer';

const backspaceToBack = async (message: string, choices: any[]) => {
  const prompt = inquirer.prompt([
    {
      type: 'list',
      name: 'result',
      message: message,
      choices: [...choices, { name: '<< Back', value: 'back' }],
    }
  ]);

  // @ts-ignore
  const ui = (prompt as any).ui;
  const rl = ui.rl;

  return new Promise((resolve) => {
    const onKeypress = (s: any, key: any) => {
      if (key && key.name === 'backspace') {
        // Remove listener
        rl.input.removeListener('keypress', onKeypress);
        // Force resolve prompt with 'back'
        ui.close();
        resolve('back');
      }
    };

    rl.input.on('keypress', onKeypress);

    prompt.then((answers) => {
      rl.input.removeListener('keypress', onKeypress);
      resolve(answers.result);
    });
  });
};

async function test() {
  const res = await backspaceToBack('Pick one (Backspace to back):', ['A', 'B', 'C']);
  console.log('Result:', res);
  process.exit();
}

test();
