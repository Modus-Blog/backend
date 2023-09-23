export default class Validator {

    constructor(table, old) {
        this.table = table
        if (old) {
            this.arg = old.arg
            this.name = old.name
            this.exists = old.exists
            this.err = old.err
        } else {
            this.arg = ""
            this.name = ""
            this.exists = true
            this.err = []
        }
    }

    validate(name) {
        this.name = name
        this.arg = this.table[name]
        this.exists = (this.arg) ? true : false
        return new Validator(this.table, this)
    }

    isRequired() {
        if (this.arg == undefined) {
            this.exists = false
            this.err.push(this.name + " is required")
        }
        return new Validator(this.table, this)
    }

    isEmail() {
        if (this.exists && !/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(this.arg)) {
            this.err.push(this.name + " is not a valid email")
        }
        return new Validator(this.table, this)
    }

    async isUnique(db, filter) {
        
        const elem = await db.findOne(filter, {});
        if (this.exists && elem) {
            this.err.push(this.name + " is already taken")
        }
        return new Validator(this.table, this)

    }

    minSize(size) {
        // console.log("minSize :", this)
        if (this.exists && this.arg.length < size) {
            this.err.push(this.name + " should be greater than " + size)

        }
        return new Validator(this.table, this)
    }

    sizeOf(size) {
        // console.log("minSize :", this)
        if (this.exists && this.arg.length != size) {
            this.err.push(this.name + " should be " + size)

        }
        return new Validator(this.table, this)
    }

    hasNoSpecialChar(){
        if(this.exists && /[^A-Za-z0-9]/.test(this.arg)){
            this.err.push(this.name+" cannot have special chars")
        }
        return new Validator(this.table, this)
    }

}