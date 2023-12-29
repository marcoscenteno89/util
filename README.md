## Utility README

### This project contains a list of utility classes

#### Multi-step web form class
#### List of classes to interact with HTML5 canvas
#### Loader class
#### Limiter class (disables certain element after event hits a limit)



### Canvas Utility with P5.js README

#### Canvas Manager
##### Description
##### The CanvasManager class provides methods for creating and managing a canvas, including creating a flow field, updating the flow field, drawing the flow field, and managing objects within the canvas.

#### Usage
##### Here is an example of how to use the CanvasManager class:
``` js
import p5 from "https://esm.sh/p5";
import { CanvasManager } from './path/to/canvas.js';

let elem = document.querySelector('#canvas');
let canvas;
const sketch = new p5((p) => {
  p.setup = () => {

    let canvasManager = new CanvasManager(p5, p, elem);

    // Set the flowfield
    canvasManager.setFlowfield(20, 0, 0.1);

    
  };
  p.draw = () => {

    // Update the flowfield
    canvasManager.updateFlowfield();

    // Draw the flowfield
    canvasManager.drawFlowfield();

  };
});
```

### Shape
#### Description
##### The Shape class provides methods for creating and managing a objects within canvas, this class does not draw into canvas and it is meant to be extended by other classes

### Shape child classes
#### Ellipse, Rect, Triangle, and Polygon
### Description
#### These classes extend from the shape class and contain the drawing method to draw in canvas.

### Usage
#### Here is an example of how to use the Shape class:

``` js

import p5 from "https://esm.sh/p5";
import { Ellipse, Rect, Triangle, Polygon } from './path/to/canvas.js';

let elem = document.querySelector('#canvas');
let canvas;
const sketch = new p5((p) => {
  p.setup = () => {
    let canvasManager = new CanvasManager(p5, p, elem);

    // Create an ellipse
    let pos = p.createVector(50, 50);
    let vel = p.createVector(1, 1);
    let acc = p.createVector(0, 0.1);
    let mass = p.createVector(20, 20);
    let ellipse = new Ellipse(canvasManager, pos, vel, acc, mass);

    // Add shape objects to canvas objects array
    canvasManager.objects.push(ellipse);
    
  };
  p.draw = () => {
    for (let shapeObj of canvas.objects) {

      // Handle object-object collisions
      shapeObj.bounceOfObject();

      // Handle object-border collisions
      shapeObj.bounceOfBorder();
      
    }
  };
});
```





### Multi-step form

##### Form class will generate a multi-step form. If no multi-step needed, simply run a form with one tab.
##### The class takes 3 parameters, 
1. Form element (required)
  - Form must contain these html elements
  ``` html
  <div class="steps"></div>
  <div class="tab" data-name="Tab 1"></div>
  <div class="status"></div>
  <div class="controller"></div>
  ```
  - input elements must go inside the .tab element & form will only recognize input fields with the class .form-input, .next button is required, prev is only required if multiple tabs. User can also add custom buttons or links in the controller area, they must have the .btn class. 


``` html
<form action="sales-entry" class="step-form" id="contact-info">
  <div class="steps"></div>
  <div class="tab" data-name="Tab 1">
    <input type="text" class="form-input" name="field_1" placeholder="Field #1">
  </div>
  <div class="tab" data-name="Tab 2">
    <input type="text" class="form-input" name="field_2" placeholder="Field #2">
  </div>
  <div class="tab" data-name="Tab 3">
    <input required type="text" class="form-input" name="field_3" placeholder="Field #3">
  </div>
  <div class="status"></div>
  <div class="controller">
    <!-- Insert your custom buttons or links here -->
    <button name="prev" type="button" class="btn">Go Back</button>
    <a href="https://google.com" class="btn">Custom button</a>
    <button name="next" type="button" class="btn">Check Now</button>
  </div>
</form>
```
2. Tab change callback function (optional)
  If callback is not passed, form will pass values to value object and move on to next tab.
``` js
// Callback will run whenver a tab changes, (does not run when going back)
const contactInfoChangeTabCallback = (form, val) => {
  return new Promise( async (resolve) => {
    console.log(val);
    resolve(true);
  });
}
```
3. Form submition callback function (optional)
  If callback is not passed, form will default to form action, if the action is a different url, user must use a protocol (https & http).
``` js
// Callback function will run when last step is submitted
const contactInfoFormCallback = (form, val) => {
  return new Promise( async (resolve) => {
    console.log(val);
    resolve(true);
  });
}
```

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.<br />
Open [http://localhost:8080](http://localhost:8080) to view it in the browser.

The page will reload if you make edits.<br />
You will also see any lint errors in the console.

