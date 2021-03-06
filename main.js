/*******************************************************************************
Awesome Terminal
cconci
*******************************************************************************/


var connectionId = -1;  //this should be an invalid ID
var rxByteCount = 0;
var txByteCount = 0;
var rxPacketCount = 0;
var txPacketCount = 0;
var rxFilterXNumberOfBytesCount = 0;
var rxFilterTimeBetweenBytesStart = (new Date()).getTime(); //gives us ms since 1/1/1970
var rxFilterShowDate = 0; //0 is no date on update

var currentFontSize = 15;

var txAutomateActive = false;
var txAutomateCurrentRow = 0;
var txAutomateEnd = false;
var txAutomateCount = 0;


/*
List all ports into drop down box on main page
*/
window.onload = function() {
  
  chrome.app.window.onBoundsChanged.addListener(window_bounds_changed);
  
  update_ports();

  //Show the version on the header
  document.querySelector('#pageTitle').innerHTML = "Awesome Terminal Chrome V"+chrome.runtime.getManifest().version;

  console.log("window.onload "+Date()+"");
  
  
  //add the recive listener
  chrome.serial.onReceive.addListener(read_data_callback);
  
  updateStatsCounters();
  
  document.querySelector('#termInput').style.fontSize = currentFontSize+"px";
  document.querySelector('#termTX').style.fontSize = currentFontSize+"px";
  document.querySelector('#termRX').style.fontSize = currentFontSize+"px";
  
};

function window_bounds_changed() {
  console.log("Windows bounds have changed");
}

function update_ports() { 
  /*
    var serial = new Serial('test1');
    
    serial.showDevices();
  */
  
  //clear the list
  document.querySelector('#portList').innerHTML = "";
  
  var onGetDevices = function(ports) {
      
    var portCount = 0;
      
    for (var i=0; i<ports.length; i++) {
      console.log(ports[i].path);//debug

      //document.querySelector('#heading').innerText += ports[i].path+",";
      document.querySelector('#portList').innerHTML += '<option value="' + ports[i].path + '">' + ports[i].path + '</option>';
      //document.querySelector('#heading').innerText += "--END";

      portCount++;
    }
    
    if(portCount === 0) {
      //no ports found
      document.querySelector('#portInfo').style.color = "blue";
      //document.querySelector('#portInfo').style.foregroundColor= "blue";
      document.querySelector('#portInfo').innerHTML = "No ports found :(";
      
    }
    else {
      document.querySelector('#portInfo').style.color = "green";
      document.querySelector('#portInfo').innerHTML = "Number of ports found:" + portCount;
    }
  };

  chrome.serial.getDevices(onGetDevices);
  
}


function connect_to_port() {
  
  console.log("Connecting to port");
  
  //Check if we are connected first
  //if(connectionId != -1) { 
    disconnect_from_port();
  //}
  
  /*
  def of all the params,
    https://developer.chrome.com/apps/serial
    
  */
  
  var port = document.querySelector('#portList').value;
  var baudRate = "";
  var dataBitsVal = document.querySelector('#DataBitsList').value;
  var parityBitVal = document.querySelector('#ParityBitList').value;
  var stopBitsVal = document.querySelector('#StopBitsList').value;
  
  if(document.querySelector('#baudRatesList').value == "Other") {
    baudRate = parseInt(document.querySelector('#customBaudRate').value);
  }
  else {
    baudRate = parseInt(document.querySelector('#baudRatesList').value);
  }
  
  
  console.log("Port Options:"+port +"@"+baudRate);
  
  /*
  This try catch does not catch the permisson(I think its permissons on linux) issue I have been seeing
   -it goes away once you add yourself to the correct group, ref the Notes.txt
  */
  try {
    
    //dataBits , parityBit , stopBits
    chrome.serial.connect(port, {bitrate: baudRate,dataBits:dataBitsVal,parityBit:parityBitVal,stopBits:stopBitsVal}, function(info) {
      
                  try {
                    connectionId = info.connectionId;
                  
                    console.log('Connected on port '+port+', with id ' + connectionId + 'and Bitrate ' + info.bitrate);
                  
                    document.querySelector('#portInfo').style.color = "green";
                    document.querySelector('#portInfo').innerHTML = "Connection open ("+port+")";
                    
                  } catch (e) {
                    console.log("Connect ERROR - check serial permisons on host");
                    
                    document.querySelector('#portInfo').style.color = "red";
                    document.querySelector('#portInfo').innerHTML = "Connection Error, check configuration";
                    
                  }
              });
  } catch(e) {
    //Drama. possibly the permissons
    //console.log(e);
    console.log("Connect ERROR - check serial permisons on host");
    
    document.querySelector('#portInfo').style.color = "red";
    document.querySelector('#portInfo').innerHTML = "Connection Error, check configuration";
    
  }
  
}

function disconnect_from_port() {
  
  chrome.serial.disconnect(connectionId, function(result) {
                
                console.log('Connection with id: ' + connectionId + ' is now closed');
            });
            
  //connectionId = -1;//set to invalid
}

function read_data_callback(info) {
  console.log("read_data_callback():stuff");
  console.log(info);
  console.log(String.fromCharCode.apply(null, new Uint8Array(info.data)));
  var uint8View = new Uint8Array(info.data);
  console.log(uint8View);
  
  //stats
  rxByteCount += uint8View.length;
  
  //append the data to the RX Window
  updateRXoutput(uint8View);
  
  //update stats on ui
  updateStatsCounters();
}

function send_data(byteBuffer) {
  
  var uint8View = new Uint8Array(byteBuffer);
  
  //stats
  txByteCount += uint8View.length;
  
  try {
    chrome.serial.send(connectionId, byteBuffer, function() {console.log('Write');});
  } catch(e) {
    //Error
    console.log("send_data() - ERROR");
    document.querySelector('#portInfo').style.color = "red";
    document.querySelector('#portInfo').innerHTML = "Connection Error, check configuration";
  }
  
  updateStatsCounters();
}

function updateStatsCounters()  {
  
  //update stats labels
  
  
  document.querySelector('#txStatsByteCount').innerHTML = "TX Byte Count:"+ padStringLeft(txByteCount+"",4," ");
  document.querySelector('#rxStatsByteCount').innerHTML = "RX Byte Count:"+ padStringLeft(rxByteCount+"",4," ");
  
}

function updateRXoutput(uint8View) {
  
  if(document.querySelector('#rxFormateOptionSelected').checked === true) {
    
    /*
    What options did the user select?
    */
    
    for(i=0;i<uint8View.length;i++) { 
    
      var nByte = arrayAlementToString(uint8View[i]);
      
      if(document.querySelector('#rxFormateOptionAfterByteRB').checked === true) {
      
        if(rxFilterShowDate === 1) {
          document.querySelector('#termRX').value += getRowIdentifierText(0,true);
          
          rxFilterShowDate = 0; //clear
        }
        
        //use to string to show the value in hex (that is the way it is entered on the UI)
        if(document.querySelector('#rxFormateOptionAfterByte').value.toLowerCase() === uint8View[i].toString(16)) {
          
          //after Byte, so we show the byte first
          document.querySelector('#termRX').value += nByte;
          
          //show byte and put \n
          document.querySelector('#termRX').value += "\n";
          
          rxFilterShowDate = 1;
          
        }
        else {
          //Show byte
          document.querySelector('#termRX').value += nByte;
        }
        
      }
      else if(document.querySelector('#rxFormateOptionBeforeByteRB').checked === true) {
        
        //use to string to show the value in hex (that is the way it is entered on the UI)
        if(document.querySelector('#rxFormateOptionBeforeByte').value.toLowerCase() === uint8View[i].toString(16)) {
          
          //Befire Byte, so we show the \n first
        
          //show byte and put \n
          document.querySelector('#termRX').value += "\n";
          
          //show row identifier
          document.querySelector('#termRX').value += getRowIdentifierText(0,true);
          
          //show byte
          document.querySelector('#termRX').value += nByte;
          
        }
        else {
          //Show byte
          document.querySelector('#termRX').value += nByte;
        }
        
      }
      else if(document.querySelector('#rxFormateOptionAfterTimeRB').checked === true) {
        
        var rxFilterTimeBetweenBytesEnd = (new Date()).getTime();
        
        var timeBetweenBytes = (rxFilterTimeBetweenBytesEnd - rxFilterTimeBetweenBytesStart);
        
        //console.log(timeBetweenBytes+"="+rxFilterTimeBetweenBytesEnd+"-"+rxFilterTimeBetweenBytesStart);
        
        //update prevTime
        rxFilterTimeBetweenBytesStart = rxFilterTimeBetweenBytesEnd;
        
        if(timeBetweenBytes > document.querySelector('#rxFormateOptionAfterTime').value) {
          
          document.querySelector('#termRX').value += "\n";
          
          document.querySelector('#termRX').value += getRowIdentifierText(0,true);
          
          document.querySelector('#termRX').value += nByte;
          
        }
        else {
          
          document.querySelector('#termRX').value += nByte;
        }
        
      }
      else if(document.querySelector('#rxFormateOptionAfterBytesRB').checked === true) {
        
        //X number of bytes filter
        
        
        if(rxFilterXNumberOfBytesCount >= document.querySelector('#rxFormateOptionAfterBytes').value
        || rxFilterXNumberOfBytesCount === 0 ) {
          
          document.querySelector('#termRX').value += "\n";
          
          document.querySelector('#termRX').value += getRowIdentifierText(0,true);
          
          document.querySelector('#termRX').value += nByte;
          
          rxFilterXNumberOfBytesCount = 0;//zero the counter
        }
        else {
          document.querySelector('#termRX').value += nByte;
        }
        
        rxFilterXNumberOfBytesCount++;
        
      }
      else {
        //normal
        document.querySelector('#termRX').value += arrayAlementsToString(uint8View);
      }
    }
    
  }
  else {
  
    //just add to the output window
    document.querySelector('#termRX').value += arrayAlementsToString(uint8View);
  }
  
  //auto scroll
  var ta = document.getElementById('termRX');
  ta.scrollTop = ta.scrollHeight;
  
}

function getRowIdentifierText(txOrRxWindow,printSpacer) {
  
  //show the date stamp or other RX row id if the option is selected
  
  var date = new Date();
  
  var output = "";
  
  var selection;
  
  if(txOrRxWindow === 0) {
    selection = document.querySelector('#rxDateTimeStampList').value;
  }
  else {
    selection = document.querySelector('#txDateTimeStampList').value;
  }
    
  
  switch(selection) {
    case "None":
      //Hide
      output = "";
      break;
    case "Local":
      output = date.toString();
      break;
    case "Epoch":
      output = (new Date().getTime());
      break;
    case "Custom 1":
      
      output = date.getFullYear()
        +""+ padStringLeft((date.getMonth() + 1)  +"" ,2,"0") 
        +""+ padStringLeft( date.getDate()        +"" ,2,"0")
        +""+ padStringLeft( date.getHours()       +"" ,2,"0") 
        +""+ padStringLeft( date.getMinutes()     +"" ,2,"0")
        +""+ padStringLeft( date.getSeconds()     +"" ,2,"0");
      break;
     
  }
  
  if(printSpacer === true
    && output !== "") {
    return output+" - ";
  }
  else {
    return output;
  }
  
}

function txUserInputInit(callType) {
  
  if(callType === 1 && txAutomateEnd === true) {
    //we have stopped te uatomte calls
    txAutomateEnd = false;
    return;
  }
  else if(callType === 0 && txAutomateActive === true) {
    
    //user pressed TX button while in automate, so drop out
    txAutomateActive = false;
    txAutomateCurrentRow = 0;
    txAutomateEnd = true;
    txAutomateCount = 0;
    //we are stopping the current TX operation
    return;
    
  }
  else {
    //normal TX button press
  }
  
  //tx the input
  txUserInput();
  
}


function txUserInput() { 
  
  //add text in the user input as a row in the output
  if( (document.querySelector('#termInput').value).length > 0) {
    
    //convert the data in the termInput into a byteBuffer
    var byteBuffer; 
    
    //check if the user input is Multi line
    if((document.querySelector('#termInput').value).includes("\n"))
    {
      console.log("User entered Multi Line input");
     
      txAutomateActive = true;
      
      //get the current Row
      var splitTxEntry = (document.querySelector('#termInput').value).split('\n');
      
      if(txAutomateCurrentRow >= splitTxEntry.length)
      {
        //we are done
        txAutomateActive = false;
        txAutomateCurrentRow = 0;
        
        return;
      }
      else
      {
        
        var nextTxTimeMS = 1000;
        //Does the row have a pre set time? (look for the |)
        if(splitTxEntry[txAutomateCurrentRow].includes("|"))
        {
          //mark up for custome timing detected   '| X''    
          var splitTxEntryWithTiming = splitTxEntry[txAutomateCurrentRow].split('|');
          
          //set buffer to send with timing options stripped
          byteBuffer = hexStringToByteArray(splitTxEntryWithTiming[0]); //set the data
          
          nextTxTimeMS = splitTxEntryWithTiming[1]; //set the timing
          
        }
        else
        {
          //set buffer to send
          byteBuffer = hexStringToByteArray(splitTxEntry[txAutomateCurrentRow]);
          
          //use global setting
          nextTxTimeMS = document.querySelector('#txInputMultiLinRowGapXms').value;
        }
        
        txAutomateCurrentRow++;//next row
        
        //callback woth param
        setTimeout(
          function() {txUserInputInit(1);}, 
          nextTxTimeMS);
        
      }
      
      
    }
    else
    {
      
      //normal
      byteBuffer = hexStringToByteArray((document.querySelector('#termInput').value));
      
      //check if any of the repeat options are on,
      if(document.querySelector('#txFormateOptionSelected').checked === true) {
        
        if(  document.querySelector('#txInputEveryXmsRB').checked === true) {
          
          //automate is on
          txAutomateActive = true;
          
          //start count down till next tx
          setTimeout(
            function() { txUserInputInit(1);}, 
            document.querySelector('#txInputEveryXms').value);
        }
        else if(document.querySelector('#txInputXtimesRB').checked === true) {
        
          if(txAutomateCount < document.querySelector('#txInputXtimes').value) {
          
            //automate is on
            txAutomateActive = true;
          
            //start count down till next tx
            setTimeout(
              function() { txUserInputInit(1);}, 
              document.querySelector('#txInputEveryXms').value);
            
            txAutomateCount++;
          
          }
          else {
            txAutomateCount = 0;
            txAutomateActive = false;
            
            return;
          }
        }
      }
    }
    
    send_data(byteBuffer);
    
    //row Identifier
    document.querySelector('#termTX').value += getRowIdentifierText(1,true);
    //Sent Data
    document.querySelector('#termTX').value += (arrayAlementsToString(new Uint8Array(byteBuffer)) +"\n");
    
    //auto scroll
    var ta = document.getElementById('termTX');
    ta.scrollTop = ta.scrollHeight;
    
  }  
  
}
