import asyncio
import aiofiles
import os

async def main():
    filename = "test.log"
    with open(filename, "w") as f:
        f.write("Hello\n")

    async with aiofiles.open(filename, "r") as f:
        print(f"Initial: {await f.read()}")
        
        # Append data
        with open(filename, "a") as f2:
            f2.write("World\n")
            
        print(f"New data: {await f.read()}")

asyncio.run(main())
