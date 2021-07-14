const idle= "card bg-secondary mb-3";
const pending= "card text-white bg-warning mb-3";
const completed= "card text-white bg-success mb-3";
const err= "card text-white bg-danger mb-3";

var app1=angular.module('app1',[]);


// service to handle socket.io

app1.factory('socket', ['$rootScope', function ($rootScope) {
    var socket = io.connect();
  
    return {
      on: function (eventName, callback) {
        function wrapper() {
          var args = arguments;
          $rootScope.$apply(function () {
            callback.apply(socket, args);
          });
        }
  
        socket.on(eventName, wrapper);
  
        return function () {
          socket.removeListener(eventName, wrapper);
        };
      },
  
      emit: function (eventName, data, callback) {
        socket.emit(eventName, data, function () {
          var args = arguments;
          $rootScope.$apply(function () {
            if(callback) {
              callback.apply(socket, args);
            }
          });
        });
      }
    };
  }]);







//Ace code editor part
const editor= ace.edit("editor");
editor.setTheme("ace/theme/dracula");
editor.session.setMode("ace/mode/python");



const chatState = {
    from: undefined,
    to: undefined
}

//generateRoomId
const generateRoomId = () => {
    let result = '';
    let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890@#$&?';
    for (let i = 0; i < 24; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];        
    }
    return result;
}


//angular
angular.element(document.querySelector("#outputField")).addClass(idle);

app1.controller("contr1",["$scope","$http","$timeout","socket",function($scope,$http,$timeout,socket){
    // socket functions
    socket.on("userLeft",(data)=>{
        console.log(`user ${data.name} left`);
    });
    socket.on("message",(data)=>{
        console.log(data.msg);
        $scope.messages.push(data.msg);
    });




    $scope.alerts=[];
    $scope.chatRoomsMenu=true;
    $scope.chatMessages=false;
    $scope.lang="py";
    $scope.messages=[];
    //change themes
    $scope.changeToMonokai=function(){
        editor.setTheme("ace/theme/monokai");
    }
    $scope.changeToDracula=function(){
        editor.setTheme("ace/theme/dracula");
    }
    $scope.changeToEclipse=function(){
        editor.setTheme("ace/theme/eclipse");
    }
    $scope.changeToGithub=function(){
        editor.setTheme("ace/theme/github");
    }
    $scope.changeToSolarD=function(){
        editor.setTheme("ace/theme/solarized_dark");
    }
    $scope.changeToSolarL=function(){
        editor.setTheme("ace/theme/solarized_light");
    }
    $scope.changeToXcode=function(){
        editor.setTheme("ace/theme/xcode");
    }
    //send messages
    $scope.sendMessage=function(){
        const msgContent=$scope.msgContent;
        $scope.msgContent=undefined;
        $scope.messages.push(msgContent);
        socket.emit("chatMessage",{msg:msgContent});
    }

    // create room
    $scope.createRoom=function(){
        if($scope.userName==undefined ){
            alert("enter username");
            return;
        }
        

        const roomId=generateRoomId();
        $scope.messages.push(`your roomID is ${roomId}`);
        const username=$scope.userName;
        console.log(roomId);

        //console.log(username);
        $scope.userName=undefined;
        $scope.chatRoomsMenu=false;
        $scope.chatMessages=true;
        socket.emit("createRoom",{id:roomId,name:username});
    }
    // join room
    $scope.joinRoom=function(){
        if($scope.userName==undefined || $scope.roomId==undefined ){
            alert("enter username and room ID");
            return;
        }
        const roomId=$scope.roomId;
        const username=$scope.userName;
        $scope.roomId=undefined;
        $scope.userName=undefined;
        $scope.chatRoomsMenu=false;
        $scope.chatMessages=true;
        socket.emit("joinRoom",{id:roomId,name:username});
    }
    // leave room
    $scope.leaveRoom=function(){
        $scope.messages=[];
        $scope.chatRoomsMenu=true;
        $scope.chatMessages=false;
        socket.emit("leaveRoom");

    }

    //show form
    $scope.showForm=function(){
        
        var x = document.getElementById("myDIV");
      console.log(x);
      console.log(x.classList.contains('open'));
        if (x.classList.contains('open')) {
          x.classList.remove("open");
        } else {
          x.classList.add("open");
        }
      }
      

    //change Language
    $scope.changeToCpp=function(){
        $scope.lang="cpp";
        editor.session.setMode("ace/mode/c_cpp");
    }
    $scope.changeToPython=function(){
        $scope.lang="py";
        console.log($scope.lang);
        editor.session.setMode("ace/mode/python");
    }
    $scope.changeToJava=function(){
        $scope.lang="java";
        editor.session.setMode("ace/mode/java");
    }


    //function to post code and recieve response
    $scope.postdata=function(){
        var lang=$scope.lang;
        
        $scope.class=pending;
        var code=editor.getValue();
        var data={
            lang:lang,
            code:code
        }
        $http.post("/run",JSON.stringify(data)).then(function(response){
            $scope.autoHide =function(){
                $timeout(function() {
                      $scope.alerts.splice(0, 1);
                }, 1000);
            }

            $scope.closeAlert = function(index) {
                $scope.alerts.splice(index, 1);
            };
            //console.log(response);
            const runData=response.data;
            const msg=`Your code is being executed. Job id for your execution is ${runData.jobId}.`
            $scope.output=msg;
            $scope.status="pending";
            let intervalId = setInterval(() => {
                const result=$http.get("/status",{params:{id:runData.jobId}}).then(function(response){
                    console.log(response);
                    const {job,success}=response.data;
                    if(success){
                        const{status:jobStatus,output:jobOutput}=job;
                        if(jobStatus=="pending"){
                            return;
                        }
                        if(jobStatus=="completed"){
                            $scope.class=completed;
                            $scope.status="Successfully Executed";
                            $scope.output=jobOutput;
                            const execTime=job.completedAt;
                            console.log(execTime);
                            
                        }
                        else{
                            $scope.class=err;
                            $scope.status="error";
                            var errOutput=JSON.parse(jobOutput);
                            console.log(errOutput);
                            $scope.output=errOutput.stderr;
                            
                        }

                        clearInterval(intervalId);
                    }
                    else{
                        clearInterval(intervalId);
                    }
                });
            }, 1000);
            
        },function(response){
            if(response){
                console.log(response);
                $scope.output={output:`${response.data.stderr}`};
            }
            else{
                $scope.output="Error connecting to server";
            }
        });
    }
}]);




