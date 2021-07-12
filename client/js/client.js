const idle= "card bg-secondary mb-3";
const pending= "card text-white bg-warning mb-3";
const completed= "card text-white bg-success mb-3";
const err= "card text-white bg-danger mb-3";

var app1=angular.module('app1',[]);

//Ace code editor part
const editor= ace.edit("editor");
editor.setTheme("ace/theme/monokai");
editor.session.setMode("ace/mode/python");


//angular
angular.element(document.querySelector("#outputField")).addClass(idle);

app1.controller("contr1",function($scope,$http){
    $scope.postdata=function(){
        var lang=$scope.lang;
        if(lang==undefined){
            alert("Please select a language");
            return;
        }
        $scope.class=pending;
        var code=editor.getValue();
        var data={
            lang:lang,
            code:code
        }
        $http.post("/run",JSON.stringify(data)).then(function(response){
            
            console.log(response);
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
            }, 750);
            
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
});