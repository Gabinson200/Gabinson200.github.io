import {MnistData} from './data.js';
export { setupDrawingCanvas, initializeApp, showConfusion};
var globalModel;
var data;

async function runNeuralNetwork() {  
  data = new MnistData();
  await data.load();
  globalModel = getModel();

  // Call functions from script.js
  await window.centerNeuralNetwork();
  await window.startNodeColorAnimation();

  await train(globalModel, data);

  await window.stopNodeColorAnimation();
  await window.enableOtherFunctionality();

  await showConfusion;
  setupDrawingCanvas(); // Call this new function to set up the drawing canvas
}

// This function will be called when the DOM is fully loaded
function initializeApp() {
    var startButton = document.getElementById('start-nn');
    if(startButton){
        startButton.addEventListener('click', async () => {
        console.log('NN training started!');
        startButton.disabled = true;
        startButton.textContent = 'Training in progress...';
        try {
            await runNeuralNetwork();
            startButton.textContent = 'Training completed';
        } catch (error) {
            console.error('Error during training:', error);
            startButton.textContent = 'Training failed';
        }
        // If you want to allow restarting, uncomment the next line
        // startButton.disabled = false;
        });
    }else{
        console.log('Start NN button DNE!');
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);

//defining model code
function getModel() {
    const model = tf.sequential();
    
    const IMAGE_WIDTH = 28;
    const IMAGE_HEIGHT = 28;
    const IMAGE_CHANNELS = 1;  
    
    // In the first layer of our convolutional neural network we have 
    // to specify the input shape. Then we specify some parameters for 
    // the convolution operation that takes place in this layer.
    model.add(tf.layers.conv2d({
      inputShape: [IMAGE_WIDTH, IMAGE_HEIGHT, IMAGE_CHANNELS],
      kernelSize: 5,
      filters: 8,
      strides: 1,
      activation: 'relu',
      kernelInitializer: 'varianceScaling'
    }));
  
    // The MaxPooling layer acts as a sort of downsampling using max values
    // in a region instead of averaging.  
    model.add(tf.layers.maxPooling2d({poolSize: [2, 2], strides: [2, 2]}));
    
    // Repeat another conv2d + maxPooling stack. 
    // Note that we have more filters in the convolution.
    model.add(tf.layers.conv2d({
      kernelSize: 5,
      filters: 16,
      strides: 1,
      activation: 'relu',
      kernelInitializer: 'varianceScaling'
    }));
    model.add(tf.layers.maxPooling2d({poolSize: [2, 2], strides: [2, 2]}));
    
    // Now we flatten the output from the 2D filters into a 1D vector to prepare
    // it for input into our last layer. This is common practice when feeding
    // higher dimensional data to a final classification output layer.
    model.add(tf.layers.flatten());
  
    // Our last layer is a dense layer which has 10 output units, one for each
    // output class (i.e. 0, 1, 2, 3, 4, 5, 6, 7, 8, 9).
    const NUM_OUTPUT_CLASSES = 10;
    model.add(tf.layers.dense({
      units: NUM_OUTPUT_CLASSES,
      kernelInitializer: 'varianceScaling',
      activation: 'softmax'
    }));
  
    
    // Choose an optimizer, loss function and accuracy metric,
    // then compile and return the model
    const optimizer = tf.train.adam();
    model.compile({
      optimizer: optimizer,
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });
  
    return model;
}
  

async function train(model, data) {
    const BATCH_SIZE = 512;
    const TRAIN_DATA_SIZE = 11000;
    const TEST_DATA_SIZE = 2000;
    const EPOCHS = 15;

    const [trainXs, trainYs] = tf.tidy(() => {
        const d = data.nextTrainBatch(TRAIN_DATA_SIZE);
        return [
        d.xs.reshape([TRAIN_DATA_SIZE, 28, 28, 1]),
        d.labels
        ];
    });

    const [testXs, testYs] = tf.tidy(() => {
        const d = data.nextTestBatch(TEST_DATA_SIZE);
        return [
        d.xs.reshape([TEST_DATA_SIZE, 28, 28, 1]),
        d.labels
        ];
    });

    // Create a loading bar
    const loadingBar = document.createElement('div');
    loadingBar.style.position = 'fixed';
    loadingBar.style.bottom = '20px';
    loadingBar.style.left = '50%';
    loadingBar.style.transform = 'translateX(-50%)';
    loadingBar.style.width = '80%';
    loadingBar.style.height = '20px';
    loadingBar.style.backgroundColor = '#f0f0f0';
    loadingBar.style.borderRadius = '10px';
    loadingBar.style.overflow = 'hidden';

    const progress = document.createElement('div');
    progress.style.width = '0%';
    progress.style.height = '100%';
    progress.style.backgroundColor = '#4CAF50';
    progress.style.transition = 'width 0.5s';

    loadingBar.appendChild(progress);
    document.body.appendChild(loadingBar);

    // Custom callback to update loading bar
    const customCallback = {
        onEpochEnd: (epoch, logs) => {
            const progressPercentage = ((epoch + 1) / EPOCHS) * 100;
            progress.style.width = `${progressPercentage}%`;
        }
    };
    
    return model.fit(trainXs, trainYs, {
        batchSize: BATCH_SIZE,
        validationData: [testXs, testYs],
        epochs: EPOCHS,
        shuffle: true,
        callbacks: customCallback
    });
}


//evaluation code
const classNames = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

function doPrediction(data, testDataSize = 1000) {
  const IMAGE_WIDTH = 28;
  const IMAGE_HEIGHT = 28;
  const testData = data.nextTestBatch(testDataSize);
  const testxs = testData.xs.reshape([testDataSize, IMAGE_WIDTH, IMAGE_HEIGHT, 1]);
  const labels = testData.labels.argMax(-1);
  const preds = globalModel.predict(testxs).argMax(-1);

  testxs.dispose();
  return [preds, labels];
}


async function showConfusion() {
    const [preds, labels] = doPrediction(data);
    const confusionMatrix = await tf.math.confusionMatrix(labels, preds, 10);
    
    // Create container for the confusion matrix
    const container = document.createElement('div');
    container.style.width = '300px';
    container.style.margin = '20px auto';
    container.style.backgroundColor = 'white';
    container.style.border = '1px solid #ccc';
    container.style.borderRadius = '5px';
    container.style.padding = '5px';
    container.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';

    // Add title
    const title = document.createElement('h3');
    title.textContent = 'Confusion Matrix';
    title.style.textAlign = 'center';
    title.style.margin = '5px 0';
    container.appendChild(title);

    // Create the matrix
    const matrix = document.createElement('div');
    matrix.style.display = 'grid';
    matrix.style.gridTemplateColumns = 'repeat(11, 1fr)';
    matrix.style.gap = '1px';
    matrix.style.backgroundColor = '#f0f0f0';
    matrix.style.padding = '1px';
    matrix.style.marginTop = '10px';
    matrix.style.fontSize = '8px';

    // Find the maximum value for color scaling
    const maxValue = confusionMatrix.max().arraySync();

    // Add headers and cells
    for (let i = 0; i < 11; i++) {
        for (let j = 0; j < 11; j++) {
            const cell = document.createElement('div');
            cell.style.backgroundColor = 'white';
            cell.style.padding = '2px';
            cell.style.textAlign = 'center';
            
            if (i === 0 && j === 0) {
                cell.textContent = 'T/P';
            } else if (i === 0) {
                cell.textContent = classNames[j - 1]; // Just the first letter
                cell.style.fontWeight = 'bold';
            } else if (j === 0) {
                cell.textContent = classNames[i - 1]; // Just the first letter
                cell.style.fontWeight = 'bold';
            } else {
                const value = confusionMatrix.arraySync()[i - 1][j - 1];
                cell.textContent = value;
                const intensity = Math.round((value / maxValue) * 200);
                cell.style.backgroundColor = `rgb(${255 - intensity}, ${255 - intensity}, 255)`;
            }
            
            matrix.appendChild(cell);
        }
    }

    container.appendChild(matrix);

    // Add labels
    const xLabel = document.createElement('div');
    xLabel.textContent = 'Predicted';
    xLabel.style.textAlign = 'center';
    xLabel.style.marginTop = '5px';
    xLabel.style.fontSize = '10px';
    container.appendChild(xLabel);

    const yLabel = document.createElement('div');
    yLabel.textContent = 'True';
    yLabel.style.writingMode = 'vertical-rl';
    yLabel.style.textOrientation = 'mixed';
    yLabel.style.transform = 'rotate(180deg)';
    yLabel.style.position = 'absolute';
    yLabel.style.left = '-15px';
    yLabel.style.top = '50%';
    yLabel.style.fontSize = '10px';
    container.appendChild(yLabel);

    var draw_area = document.getElementById('draw-area');
    if(draw_area){
        draw_area.appendChild(container);
    }else{
        console.log('draw area not found');
    }

    labels.dispose();
    preds.dispose();
}


function setupDrawingCanvas() {
    var canvas = document.getElementById('drawing-canvas');
    if(!canvas){
        console.log('no canvas found');
        return;
    }
    const ctx = canvas.getContext('2d');
    let drawing = false;
  
    // Set up canvas for drawing
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'white';
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  
    // Mouse event listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
  
    // Touch event listeners
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
  
    function startDrawing(e) {
      drawing = true;
      draw(e);
    }
  
    function stopDrawing() {
      drawing = false;
      ctx.beginPath();
    }
  
    function draw(e) {
      if (!drawing) return;
  
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
  
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  
    // Clean button
    var clean_button = document.getElementById('clean-btn');
    if(clean_button){
        clean_button.addEventListener('click', () => {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        });
    }else{
        console.log('clean button not found');
    }
  
    // Evaluate button
    var evaluate_button = document.getElementById('evaluate-btn');
    if(evaluate_button){
        evaluate_button.addEventListener('click', async () => {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            await evaluateDrawing(imageData);
        });
    }else{
        console.log('evaluate button not found');
    }
}


async function evaluateDrawing(imageData) {
    // Preprocess the image data
    const tensor = tf.browser.fromPixels(imageData, 1)
      .resizeBilinear([28, 28])
      .mean(2)
      .expandDims(0)
      .expandDims(-1)
      .toFloat()
      .div(255.0);
  
    // Make prediction
    const prediction = globalModel.predict(tensor);
    const predictionArray = await prediction.data();
    
    // Display the prediction as bar graphs
    displayPredictionBarGraphs(predictionArray);
    
    // Dispose of the tensor to free up memory
    tensor.dispose();
    prediction.dispose();
    
    return predictionArray;
}

function displayPredictionBarGraphs(predictionArray) {
    var container = document.getElementById('prediction-result');
    if(!container){
        console.log('no predictions contrainer found');
        return;
    }
    container.innerHTML = '<h3>Prediction Result:</h3>'; // Reset content but keep the title
    container.style.textAlign = 'center'; // Center the content of the container

    const maxPrediction = Math.max(...predictionArray);
    const predictedClass = predictionArray.indexOf(maxPrediction);
    
    const predictedClassElement = document.getElementById('predicted-class');
    if (predictedClassElement) {
        predictedClassElement.textContent = `Predicted number: ${predictedClass}`;
    } else {
        const predictedClassPara = document.createElement('p');
        predictedClassPara.id = 'predicted-class';
        predictedClassPara.textContent = `Predicted number: ${predictedClass}`;
        container.appendChild(predictedClassPara);
    }
    
    const barGraphContainer = document.createElement('div');
    barGraphContainer.style.marginTop = '10px';
    barGraphContainer.style.display = 'inline-block'; // This allows the div to be centered
    barGraphContainer.style.textAlign = 'left'; // Align the content inside to the left
    
    for (let i = 0; i < predictionArray.length; i++) {
        const percentage = (predictionArray[i] * 100).toFixed(2);
        
        const barContainer = document.createElement('div');
        barContainer.style.display = 'flex';
        barContainer.style.alignItems = 'center';
        barContainer.style.justifyContent = 'flex-start';
        barContainer.style.marginBottom = '5px';
        
        const label = document.createElement('span');
        label.textContent = `${i}: `;
        label.style.minWidth = '30px';
        barContainer.appendChild(label);
        
        const barWrapper = document.createElement('div');
        barWrapper.style.width = '200px';
        barWrapper.style.backgroundColor = '#ddd';
        barWrapper.style.marginRight = '10px';
        
        const bar = document.createElement('div');
        bar.style.width = `${percentage}%`;
        bar.style.height = '20px';
        bar.style.backgroundColor = i === predictedClass ? '#4CAF50' : '#3498db';
        bar.style.transition = 'width 0.5s ease-in-out';
        barWrapper.appendChild(bar);
        
        barContainer.appendChild(barWrapper);
        
        const percentageLabel = document.createElement('span');
        percentageLabel.textContent = `${percentage}%`;
        percentageLabel.style.minWidth = '60px'; // Give some fixed width to align percentage values
        barContainer.appendChild(percentageLabel);
        
        barGraphContainer.appendChild(barContainer);
    }
    
    container.appendChild(barGraphContainer);
}