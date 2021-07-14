const express=require("express");

const app = express();

const path=require("path");

const {v4:uuid}=require("uuid");

const fs=require("fs");

const {exec}=require("child_process");

const http = require('http').createServer(app)

const io=require("socket.io")(http);


//Mongoose connect to mongodb
const mongoose=require("mongoose");
const { Socket } = require("dgram");

app.use(express.urlencoded({extended:true}));
app.use(express.json());

const port=process.env.PORT || 3000;

http.listen(port,()=>{
  console.log(`Listening to port ${port}`);
});


mongoose.connect('mongodb+srv://Fidistar:9912411309@cluster0.bcla1.mongodb.net/myFirstDatabase?retryWrites=true&w=majority', 
{useNewUrlParser: true, useUnifiedTopology: true},(err)=>{
    if(err){
        console.error(err);
        process.exit(1);
    }
    console.log("connected to mongodb successfully")
});

//Models
const JobSchema = mongoose.Schema(
  {
    lang: {
      type: String,
      required: true,
      enum: ["cpp","py"]
    },
    filepath: {
      type: String,
      required: true
    },
    submittedAt: {
      type: Date,
      default: Date.now
    },
    startedAt: {
      type: Date
    },
    completedAt:{
      type: Date
    },
    output:{
      type: String
    },
    status:{
      type: String,
      required: true,
      default:"pending",
      enum: ["pending","completed","error"]
    }
  }
);
const Job=mongoose.model("job",JobSchema);

//codes ip and op folders functions
const codesDirectory = path.join(__dirname,"codes");
if(!fs.existsSync(codesDirectory)){
    fs.mkdirSync(codesDirectory,{recursive:true});
}
const outputPath = path.join(__dirname, "outputs");

if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath, { recursive: true });
}

//file generation function
const generateFile = async(format,content)=>{
  const jobId= uuid();
  console.log("jobid in generate: ",jobId);
  const filename= `${jobId}.${format}`;
  const filepath=path.join(codesDirectory,filename);
  await fs.writeFileSync(filepath,content);
  return filepath;
}

//Executing codes functions

const executeCpp = (filepath) => {
  const jobId = path.basename(filepath).split(".")[0];
  const outPath = path.join(outputPath, `${jobId}.out`);

  return new Promise((resolve, reject) => {
    exec(
      `g++ ${filepath} -o ${outPath} && cd ${outputPath} && ./${jobId}.out`,
      (error, stdout, stderr) => {
        error && reject({ error, stderr });
        stderr && reject(stderr);
        resolve(stdout);
      }
    );
  });
};

const executePy = (filepath) => {
    return new Promise((resolve, reject) => {
      exec(
        `python ${filepath}`,
        (error, stdout, stderr) => {
          error && reject({ error, stderr });
          stderr && reject(stderr);
          resolve(stdout);
        }
      );
    });
  };




app.use(express.static(__dirname + '/../client'));






// routes
app.get('/' ,  (req , res )=> {
	console.log(`connected to port: ${port} `);
});

app.get('/status',async (req,res)=>{
    const jobId=req.query.id;
    if(jobId==undefined){
      return res.status(400).json({success:false,error:"jobId is missing"});
    }
    //console.log(jobId);
    const job=await Job.findById(jobId);
    if (job === undefined) {
      return res.status(400).json({ success: false, error: "no job with given id" });
    }
    return res.status(200).json({success:true,job});

});

app.post('/run',async (req,res)=>{
    const code=req.body.code;
    const lang=req.body.lang;

    if(code===undefined){
        return res.status(400).json({success:false,error:"Empty code"});
    }
    let job;

    try{
      const filepath=await generateFile(lang,code);
      job=await new Job({lang,filepath}).save();
      const jobId=job["_id"];

      //addToQueue(jobId);
      console.log("job ide extracted is :",jobId);
      res.status(201).json({success:true,jobId});
      var output;
      job["startedAt"]=new Date();
      if(job.lang==='cpp'){
          output=await executeCpp(filepath)
      }
      if(job.lang=='py'){
          output=await executePy(filepath);
      }
      //console.log({filepath,output});
      job["completedAt"]=new Date();
      job["status"]="completed";
      job["output"]=output;
      await job.save();
      
    }
    catch(err){
      job["completedAt"]=new Date();
      job["status"]="error";
      job["output"]=JSON.stringify(err);
      await job.save();
      return res.status(500).json({success:false,err:JSON.stringify(err)});
    }
});

// socket run when client is connected

io.on("connection",(socket)=>{
  let userId;
  console.log("a new user Connected.....");
  socket.on("createRoom",(data)=>{
    socket.roomId=data.id;
    socket.userName=data.name;
    socket.join(data.id);

    console.log(`room with id: ${data.id} is created`);
  });
  socket.on("joinRoom",(data)=>{
    socket.roomId=data.id;
    socket.userName=data.name;
    socket.join(data.id);
    console.log(`${data.name} joined the room`);
    socket.broadcast.to(data.id).emit('message',{msg:`${data.name} entered the chat`});
  });
  
  socket.on("chatMessage",(data)=>{
    socket.broadcast.to(socket.roomId).emit('message',data);
  });
  socket.on("leaveRoom",()=>{
    let rid=socket.roomId;
    let un=socket.userName;
    socket.broadcast.to(rid).emit('message',{msg:`${un} left the chat`});
    socket.leave(rid);
  })
  socket.on("disconnect",()=>{

    if(socket.roomId!=undefined){
      socket.to(socket.roomId).emit("userLeft",{name:socket.userName});
    }
  });
});